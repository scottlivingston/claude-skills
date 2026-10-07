export const meta = {
  name: 'doc-gate',
  description: 'Find→validate→propose→validate→route pipeline over a planning document (a wayfinder slice or map, or a spec) — auto-apply only provably derivable repairs, escalate intent',
  phases: [
    { title: 'Read', detail: 'the gate\'s find-side readers over the material, in parallel' },
    { title: 'Label', detail: 'normalize reports into IDed findings; dedup vs prior summaries' },
    { title: 'Validate findings', detail: 'fresh adversarial validators — refuted findings leave the pipeline here' },
    { title: 'Propose', detail: 'one proposer per chunk over its surviving findings' },
    { title: 'Validate repairs', detail: 'fresh adversarial validators; text-error rejections get one re-proposal round' },
    { title: 'Resolve', detail: 'script routing — derivable repairs auto-applied by a serial edit agent, the rest escalated; final stage posts pending questions' },
  ],
}

// Template for the document gates (/map-review, /spec-review). This file owns
// every stage prompt and the routing; /finding-pipeline owns the invariants;
// each gate skill owns what its fill carries (defect list, derivable kinds,
// escalation conditions, verdicts) and fills it here.
//
// USAGE: fill every FILL slot below per /finding-pipeline's Workflow authoring
// invariants, then launch the result as the Workflow `script`. An unfilled slot
// throws "FILL is not defined" at launch, before any agent spawns.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const GATE_NAME = FILL          // "map-review" | "spec-review" — names the gate's markers: <!-- GATE_NAME pending-questions -->
const ID_PREFIX = FILL          // finding-ID prefix: "MR" | "SR" — IDs run <prefix>-1, -2, ... per run
const GATE_PURPOSE = FILL       // one or two sentences: what this gate checks and what it never re-litigates (merits are settled)
const MATERIAL_SOURCE = FILL    // one line: what is under review and in which mode ("slice #12 'Auth' of map #3, slice mode")
const MATERIAL = FILL           // the full material as read in the skill's load step — every unit in full, each headed by its ref — one JSON string
const SCOPE_NOTE = FILL         // one line: what a finding may anchor in, and what is context only ("the slice's claimed tickets and the map-wide decisions; other slices are context")
const READ_OP = FILL            // one-liner: how an agent fetches a ticket, decision, or comment by ref per /issue-tracker — "" if none
const READERS = FILL            // the find stage: [{ label: "cross-read", tier: "auditor" | "decider", brief: "what this reader holds against what" }] — one entry per reader the skill names
const DEFECTS = FILL            // the skill's defect list, verbatim — what to hunt, never what to escalate
const DERIVABLE = FILL          // the skill's derivable-repair kinds, verbatim — the only repairs that may auto-apply
const ESCALATE_WHEN = FILL      // gate-local conditions that escalate a finding whatever its repair ("a finding on an already-shipped slice"), or ""
const REPAIR_KINDS = FILL       // the gate's verdicts as repair kinds: [{ kind: "amend", what: "what applying it edits" }, ...] — the proposer picks one per repair
const EDIT_TARGET = FILL        // one or two sentences: where repairs land (which bodies, comments, index lines) — never a separate artifact
const QUESTION_NOTES = FILL     // the skill's local block rules for the assembler (how sides are named, where paths are welcome), or ""
const PRIOR_SUMMARIES = FILL    // pre-fetched prior <!-- GATE_NAME summary --> comments: ["..."] — [] if none
const ANSWER_RECORD = FILL      // one line: where earlier verdicts landed in the material, so validators treat them as binding ("amendment comments on the winning tickets")
const GATE_ISSUE_REF = FILL     // tracker ref of the issue the gate posts to ("#12")
const TRACKER_MECHANICS = FILL  // prose: the tracker's read/edit-body/comment operations per /issue-tracker (exact commands), or null → no auto-apply, no post; the manager does both

const EXECUTOR_MODEL = FILL     // per /model-policy: the executor tier's resolved model ('sonnet'), or null to inherit the session model
const DECIDER_MODEL = FILL      // per /model-policy: the decider tier's resolved model ('opus'), or null to inherit
const AUDITOR_MODEL = FILL      // per /model-policy: the auditor tier's resolved model ('fable') for the run-once find-side reads, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the run genuinely deviates ═══════════

const CHUNK_SIZE = 5 // findings per chunk — each chunk rides its own validate → propose → validate-repair chain

const TIER_MODEL = { executor: EXECUTOR_MODEL, decider: DECIDER_MODEL, auditor: AUDITOR_MODEL }
const tier = t => (TIER_MODEL[t] ? { model: TIER_MODEL[t] } : {})

const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')

const MARKER = '<!-- ' + GATE_NAME + ' pending-questions -->'

const SCOPE_RULE = 'SCOPE — the material under review is ' + MATERIAL_SOURCE + '. ' + SCOPE_NOTE + ' A finding must anchor in what is in scope; an absence — something the material was meant to contain and does not — has no anchor and is in scope wherever the material was the thing meant to hold it.'

const MERITS_RULE = 'MERITS ARE SETTLED. ' + GATE_PURPOSE + ' A finding that argues a decision was the wrong call, rather than that the material fails this gate as written, is not a finding.'

const COMMON = j([
  'This is the ' + GATE_NAME + ' document gate.',
  MERITS_RULE,
  SCOPE_RULE,
  READ_OP ? 'To zoom a unit not given in full below, fetch it by ref: ' + READ_OP : null,
  'The material (' + MATERIAL_SOURCE + '):',
  MATERIAL,
])

const PRIOR = PRIOR_SUMMARIES.length
  ? 'Prior ' + GATE_NAME + ' summaries — answered verdicts recorded here, and what they landed (' + ANSWER_RECORD + '), are BINDING source text; a finding one directly governs diverges from the answer and is repaired to match it, never re-asked:\n' + PRIOR_SUMMARIES.join('\n---\n')
  : null

const REPAIR_KIND_LIST = REPAIR_KINDS.map(k => '- ' + k.kind + ' — ' + k.what).join('\n')

// ── Schemas ──────────────────────────────────────────────────────────────────

const SOURCE = {
  type: 'object', required: ['title', 'gist', 'quote', 'ref'],
  properties: {
    title: { type: 'string', description: 'the ticket, decision, or file the claim is held against' },
    gist: { type: 'string', description: 'one line: what it decided or establishes, in the domain\'s terms' },
    quote: { type: 'string', description: 'the sentence the finding turns on, quoted verbatim' },
    ref: { type: 'string', description: 'its ref (#N, D3, path:line) — a record handle, never the only thing carried' },
  },
}

const FINDING_FIELDS = {
  id: { type: 'string' },
  defect: { type: 'string', description: 'the defect-list entry this is an instance of' },
  kind: { enum: ['in-material', 'absence'], description: 'absence = something the material was meant to contain and does not; its anchor fields are ""' },
  anchorRef: { type: 'string', description: 'the unit the finding sits in (#N, D3, "body") — "" when kind=absence' },
  anchorQuote: { type: 'string', description: 'the sentence at fault, quoted verbatim — "" when kind=absence; never invent one' },
  description: { type: 'string', description: 'one line' },
  citedSources: { type: 'array', minItems: 1, items: SOURCE, description: 'every unit, decision, or code fact the finding holds the material against — carried as text, since the cold-reader assembler writes from these fields alone' },
  dedup: { enum: ['none', 'possibly-duplicates', 'already-adjudicated'] },
  dedupRef: { type: 'string', description: 'the prior outcome; "" when dedup=none' },
}
const FINDINGS_SCHEMA = {
  type: 'object', required: ['findings'],
  properties: { findings: { type: 'array', items: { type: 'object', required: Object.keys(FINDING_FIELDS), properties: FINDING_FIELDS } } },
}

const FINDING_VERDICT_FIELDS = {
  id: { type: 'string' },
  scope: { enum: ['in-scope', 'absence', 'out-of-scope'], description: 'settled BEFORE the merits: out-of-scope = it anchors only in context material, and the script refutes it whatever its merits' },
  verdict: { enum: ['finding-validated', 'finding-refuted'] },
  reason: { type: 'string' },
}
const FINDING_VERDICTS_SCHEMA = {
  type: 'object', required: ['verdicts'],
  properties: { verdicts: { type: 'array', items: { type: 'object', required: Object.keys(FINDING_VERDICT_FIELDS), properties: FINDING_VERDICT_FIELDS } } },
}

const PROPOSAL_FIELDS = {
  id: { type: 'string' },
  leaveAloneCost: { type: 'string', description: 'filled FIRST: which argument, criterion, or instruction downstream actually breaks if the defect stands — "nothing" when nothing does' },
  noRepairNeeded: { type: 'boolean', description: 'true only when leaveAloneCost is honestly nothing' },
  repairKind: { enum: REPAIR_KINDS.map(k => k.kind) },
  location: { type: 'string', description: 'the unit the repair edits (#N, D3, the body\'s section)' },
  anchorSnippet: { type: 'string', description: 'a short verbatim quote of the text that changes — never a bare line number; "" for a pure insertion, with location saying where' },
  replacementText: { type: 'string', description: 'the drafted text exactly as it would land ("" for a strike)' },
  readings: { type: 'array', items: { type: 'object', required: ['reading', 'replacementText'], properties: { reading: { type: 'string' }, replacementText: { type: 'string' } } }, description: 'a drafted repair per plausible reading when the finding admits more than one; [] when it admits one' },
  derivable: { type: 'boolean', description: 'claim: the record already contains this answer' },
  derivedFrom: { type: 'string', description: 'the record text that settles it, quoted with its ref — "" when derivable=false' },
  size: { enum: ['quick-fix', 'needs-a-session'] },
}
const PROPOSALS_SCHEMA = {
  type: 'object', required: ['proposals'],
  properties: { proposals: { type: 'array', items: { type: 'object', required: Object.keys(PROPOSAL_FIELDS), properties: PROPOSAL_FIELDS } } },
}

const FIX_VERDICT_FIELDS = {
  id: { type: 'string' },
  verdict: { enum: ['validated', 'fix-rejected', 'needs-human'] },
  rejectKind: { enum: ['text', 'substance'], description: 'required when verdict=fix-rejected, omitted otherwise: text = the error is in the repair\'s own replacement text (a name that does not exist, a misquote, an anchor at the wrong place, or an addition to strip) and the reason carries the correction; substance = the repair itself does not work' },
  reason: { type: 'string' },
  derivable: { type: 'boolean', description: 'final word on the proposer\'s claim' },
  derivedFrom: { type: 'string', description: 'the record text that settles it, quoted with its ref — "" when derivable=false' },
  escalateCondition: { type: 'string', description: 'which of the gate\'s escalation conditions holds, or "" when none' },
  dependsOn: { type: 'array', items: { type: 'string' } },
  invalidatedBy: { type: 'array', items: { type: 'string' } },
}
const FIX_VERDICTS_SCHEMA = {
  type: 'object', required: ['verdicts'],
  properties: { verdicts: { type: 'array', items: { type: 'object', required: ['id', 'verdict', 'reason', 'derivable', 'derivedFrom', 'escalateCondition', 'dependsOn', 'invalidatedBy'], properties: FIX_VERDICT_FIELDS } } },
}

const APPLY_SCHEMA = {
  type: 'object', required: ['applied', 'demoted'],
  properties: {
    applied: {
      type: 'array',
      items: {
        type: 'object', required: ['id', 'location', 'before', 'after'],
        properties: {
          id: { type: 'string' },
          location: { type: 'string', description: 'the unit edited, as a link or ref — the revert handle' },
          before: { type: 'string', description: 'the text as it stood' },
          after: { type: 'string', description: 'the text as it now stands' },
        },
      },
    },
    demoted: { type: 'array', items: { type: 'object', required: ['id', 'reason'], properties: { id: { type: 'string' }, reason: { type: 'string' } } } },
  },
}

const LEDGER_SCHEMA = {
  type: 'object', required: ['posted', 'marker'],
  properties: {
    posted: { type: 'boolean' },
    marker: { type: 'string', description: 'the marker used, or the failure reason when posted=false' },
  },
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function readerPrompt(r) {
  return j([
    'You are the ' + r.label + ' reader — the find stage of a document review.',
    r.brief,
    COMMON,
    'Defects to hunt:',
    DEFECTS,
    'Report each finding: the defect it is an instance of; the unit and the verbatim sentence at fault (an absence: say what is missing and what was meant to hold it — never invent a location); a one-line description; and every source you hold it against, as its title, its gist, and the quoted sentence — a claim with no citable source is not a finding. Report what you find; whether it escalates is not yours to judge.',
    'Your final text IS the report.',
  ])
}

function labelPrompt(reports) {
  return j([
    'You are the labeling stage of a document review — normalize the raw reader reports below into discrete findings (light cleaning, no re-reviewing).',
    SCOPE_RULE,
    'Assign IDs ' + ID_PREFIX + '-1, ' + ID_PREFIX + '-2, ... in report order. Readers overlap — one finding per underlying defect.',
    'Set kind=absence (anchorRef "", anchorQuote "") for anything reported as missing; in-material for everything else. Carry every cited source as title, gist, and quote.',
    'Reader reports:',
    reports.map(r => '--- ' + r.label + ' ---\n' + r.text).join('\n'),
    PRIOR_SUMMARIES.length
      ? 'Dedup conservatively against the prior summaries below. Already adjudicated there (auto-applied, refuted, answered, left as-is) → dedup=already-adjudicated, dedupRef=the prior outcome. A new instance of a known pattern stays (dedup=none). An uncertain match stays, dedup=possibly-duplicates — a visible duplicate is recoverable, a silent suppression is not.\n' + PRIOR_SUMMARIES.join('\n---\n')
      : 'No prior summaries — dedup=none throughout.',
  ])
}

function findingValidatorPrompt(findings) {
  return j([
    'You are a fresh adversarial validator in a document review. You did not author these findings; try to REFUTE each one, on its own — no repair exists yet.',
    COMMON,
    PRIOR,
    'Findings to validate:',
    JSON.stringify(findings.map(f => ({ id: f.id, defect: f.defect, kind: f.kind, anchorRef: f.anchorRef, anchorQuote: f.anchorQuote, description: f.description, citedSources: f.citedSources }))),
    'Settle SCOPE first, before the merits, as the scope field: in-scope (it anchors in material under review), absence (the material was meant to hold something and does not), or out-of-scope (it anchors only in context material). An out-of-scope finding is refuted on scope however real it is.',
    'Then per finding: is it real? Read the cited sources and the anchored text yourself — does each source say what the finding claims, and do the two actually fail to compose as claimed? Reading a sentence charitably in the light of the rest of the material is part of the test. A finding that re-argues a settled decision\'s merits is refuted. verdict=finding-refuted (with the reason) or finding-validated.',
  ])
}

function proposerPrompt(survivors) {
  return j([
    'You are the repair proposer of a document review. Every finding below survived adversarial validation; its reality is settled.',
    COMMON,
    PRIOR,
    'Repair kinds this gate admits:',
    REPAIR_KIND_LIST,
    'Where repairs land: ' + EDIT_TARGET,
    'Repairs the record can prove, and so may auto-apply — the record already contains the answer:',
    DERIVABLE,
    'Validated findings, each with its validator\'s reasoning:',
    JSON.stringify(survivors.map(f => ({ id: f.id, defect: f.defect, kind: f.kind, anchorRef: f.anchorRef, anchorQuote: f.anchorQuote, description: f.description, citedSources: f.citedSources, validatorReasoning: f.findingReason }))),
    'Per finding, fill leaveAloneCost FIRST: which argument, criterion, or instruction downstream actually breaks if the defect stands. If the honest answer is nothing, set noRepairNeeded=true and stop there for that finding.',
    'Otherwise draft the smallest concrete repair: its kind, the unit it edits, a short verbatim snippet of the text that changes, and the replacement text exactly as it would land. Striking outranks correcting: a fact the material copies from its owner (a count, a figure, an ordered list) is repaired by deleting the copy and leaning on the pointer when the lookup is cheap, and corrected in place, dated, only when the lookup is expensive. Where the finding admits more than one reading, draft a repair per plausible reading in readings — the user\'s answer picks one.',
    'Claim derivable=true only when the record already contains the answer (quote it with its ref in derivedFrom). A repair that adds, removes, or picks among readings of a decision is never derivable.',
    'Draft only the correction the finding forces. Do not add a prohibition, constraint, house rule, or new decision alongside it.',
  ])
}

function fixValidatorPrompt(items, roster) {
  return j([
    'You are a fresh adversarial repair validator in a document review — not the proposer, and not the finding validator. Try to REFUTE each repair.',
    COMMON,
    PRIOR,
    'Repair kinds this gate admits:',
    REPAIR_KIND_LIST,
    'Repairs the record can prove (the derivable kinds):',
    DERIVABLE,
    ESCALATE_WHEN ? 'This gate\'s escalation conditions — any that holds escalates the finding whatever its repair:\n' + ESCALATE_WHEN : null,
    'Repairs to validate (each with its finding and the finding-validator\'s reasoning):',
    JSON.stringify(items.map(f => ({ id: f.id, defect: f.defect, anchorRef: f.anchorRef, anchorQuote: f.anchorQuote, description: f.description, citedSources: f.citedSources, findingReasoning: f.findingReason, leaveAloneCost: f.leaveAloneCost, repairKind: f.repairKind, location: f.location, anchorSnippet: f.anchorSnippet, replacementText: f.replacementText, readings: f.readings, derivable: f.derivable, derivedFrom: f.derivedFrom, size: f.size, priorRejection: f.firstRejection || null }))),
    'Every finding in this review, for the edge fields below — dependsOn / invalidatedBy may name IDs outside your batch:',
    roster,
    'Per repair, check: (1) does it actually resolve the finding? (2) is it proportionate — the minimal edit that clears the finding, striking a copied fact before correcting it? (3) is its own text right — the anchor snippet appears verbatim at the location, every name it uses exists, every quote is exact? (4) settle derivable — final word: true only when the record already contains the answer, quoted in derivedFrom with its ref, and the repair is one of the derivable kinds above; a repair that adds, removes, or picks among readings of a decision is never derivable. (5) name any of the gate\'s escalation conditions that holds in escalateCondition, else "". (6) new rules: a repair that adds a prohibition, constraint, house rule, or new decision beyond the correction the finding forces is fix-rejected on that addition — say what to strip; new rules are the owner\'s to ask for.',
    'Verdict per repair: validated, fix-rejected (with the reason), or needs-human (a genuine trade-off the user must call). The finding\'s reality is NOT on the table — record any lingering doubt about the premise inside a fix-rejected reason.',
    'On fix-rejected, set rejectKind: text when the fault is in the repair\'s own text — failed check (3), or a check-(6) addition whose forced correction stands without it — and put the exact correction in the reason; substance when the repair itself does not work (checks 1–2), or when the correction is incoherent without its addition. When unsure, substance. A repair carrying priorRejection is a redraft of one rejected for its text — judge the redraft on its own merits.',
    'Fill the edge fields instead of burying edges in prose: dependsOn = IDs whose repairs must land for this one to read right; invalidatedBy = IDs whose accepted repair makes this repair\'s premise or wording false.',
  ])
}

function reproposerPrompt(items) {
  return j([
    'You are a fresh repair proposer in a document review. Each repair below was rejected by a validator for an error in its own text — not its substance. Redraft each with the validator\'s correction applied; change nothing the correction does not require.',
    COMMON,
    'Repair kinds this gate admits:',
    REPAIR_KIND_LIST,
    'Where repairs land: ' + EDIT_TARGET,
    'Rejected repairs, each with its finding and the rejection:',
    JSON.stringify(items.map(f => ({ id: f.id, defect: f.defect, anchorRef: f.anchorRef, anchorQuote: f.anchorQuote, description: f.description, citedSources: f.citedSources, leaveAloneCost: f.leaveAloneCost, repairKind: f.repairKind, location: f.location, anchorSnippet: f.anchorSnippet, replacementText: f.replacementText, readings: f.readings, derivable: f.derivable, derivedFrom: f.derivedFrom, size: f.size, rejection: f.firstRejection }))),
    'Verify every name, quote, and anchor in your redraft against the material yourself. Keep leaveAloneCost as given; noRepairNeeded=false.',
  ])
}

function applyAgentPrompt(batch) {
  return j([
    'You are the serial edit agent of a document review — the only agent that edits the material. Apply the batch below IN ORDER, one edit per finding ID, to ' + GATE_ISSUE_REF + ' and the units it links.',
    'Where repairs land: ' + EDIT_TARGET,
    'Tracker operations:',
    TRACKER_MECHANICS,
    'Fetch each unit fresh and anchor each edit by its quoted snippet, never a position. If the snippet is no longer there, or a finding\'s staleAfter siblings have made its premise or wording false, apply nothing for it and demote it, saying why.',
    'Report every applied edit with the location (link or ref), the text before, and the text after — the audit digest lists each one as its revert handle.',
    'Batch:',
    JSON.stringify(batch.map(f => ({ id: f.id, repairKind: f.repairKind, location: f.location, anchorSnippet: f.anchorSnippet, replacementText: f.replacementText, derivedFrom: f.derivedFrom, dependsOn: f.dependsOn || [], staleAfter: f.staleAfter || [] }))),
  ])
}

function ledgerPrompt(escalations, digest) {
  return j([
    'You are the final stage of a ' + GATE_NAME + ' review, and a fresh assembler: you hold nothing but the structured findings below. Post ONE comment on ' + GATE_ISSUE_REF + ' opening with the marker ' + MARKER + ' — durable gate state a later session resumes the question loop from, so completeness beats brevity.',
    'Tracker operations:\n' + TRACKER_MECHANICS,
    'The comment body, in order:',
    '1. The audit digest of this round\'s auto-actions, stated as done — every auto-edit with its location, before, and after: ' + JSON.stringify(digest),
    '2. One question block per escalation below, written for a COLD READER — someone who has not read the material or this review must be able to pick an option from the block alone. Speak the domain: behaviours, decisions, consequences. Name every cited source by what it decided or establishes (from its title, gist, and quote), never by its ref alone; the finding ID appears once, trailing in parentheses in the header. Anything you cannot explain from the fields you hold, expand from the cited source text the finding carries. Format each:',
    '### <plain title of what is being decided> — <i> of <n> (<ID>)\n',
    '<One or two sentences: what part of the plan this concerns, and what the question is.>\n',
    '> <the sentence the question turns on — quoted verbatim from the finding\'s anchor or source fields, with its anchor. An absence has no sentence to quote: say the material is silent and quote whatever was meant to cover it.>\n',
    '<What is wrong with that text, and what breaks downstream if it simply stands — the leaveAloneCost field, in the reader\'s terms.>\n',
    '- **<option, as an outcome — what holds, what changes>** — <what it costs, what it triggers>',
    '- **<option, as an outcome>** — <what it costs, what it triggers>\n',
    '<The option you would pick, and the one-line why.>',
    'Options are drawn from the gate\'s repair kinds, with the drafted replacement text attached so the ask is a verdict on concrete text — one option per plausible reading where the finding carries several:',
    REPAIR_KIND_LIST,
    QUESTION_NOTES,
    'The question class is routing vocabulary: it appears in the audit digest\'s counts, never inside a block. A joined finding rides its target\'s block as one line of context, never its own block.',
    'The escalations:',
    JSON.stringify(escalations),
  ])
}

// ── Stage runners ────────────────────────────────────────────────────────────

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function applyProposal(f, p) {
  f.leaveAloneCost = p ? p.leaveAloneCost : 'proposal missing'
  f.noRepairNeeded = p ? !!p.noRepairNeeded : false
  f.repairKind = p ? p.repairKind : null
  f.location = p ? p.location : ''
  f.anchorSnippet = p ? p.anchorSnippet : ''
  f.replacementText = p ? p.replacementText : 'proposal missing'
  f.readings = p ? p.readings || [] : []
  f.derivable = p ? !!p.derivable : false
  f.derivedFrom = p ? p.derivedFrom : ''
  f.size = p ? p.size : 'needs-a-session'
}

// A missing verdict is needs-human (less action); a rejection with no rejectKind is substance.
function applyFixVerdict(f, v) {
  f.fixVerdict = v ? v.verdict : 'needs-human'
  f.fixReason = v ? v.reason : 'repair-validator result missing'
  f.rejectKind = v && v.verdict === 'fix-rejected' ? (v.rejectKind === 'text' ? 'text' : 'substance') : null
  f.derivable = v ? !!v.derivable && f.derivable : false
  f.derivedFrom = v ? v.derivedFrom : ''
  f.escalateCondition = v ? v.escalateCondition || '' : ''
  f.dependsOn = v ? v.dependsOn || [] : []
  f.invalidatedBy = v ? v.invalidatedBy || [] : []
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

const incomplete = []

phase('Read')
const readerResults = await parallel(READERS.map(r => () =>
  agent(readerPrompt(r), { ...tier(r.tier), phase: 'Read', label: 'read:' + r.label }).then(text => (text ? { label: r.label, text } : null))))
const reports = readerResults.filter(Boolean)
READERS.forEach((r, i) => { if (!readerResults[i]) incomplete.push('reader ' + r.label + ' returned nothing') })

phase('Label')
let labeled = []
if (reports.length) {
  const l = await agent(labelPrompt(reports), { ...tier('auditor'), schema: FINDINGS_SCHEMA, phase: 'Label', label: 'label' })
  if (l) labeled = l.findings
  else incomplete.push('labeling stage returned nothing')
}

const shelved = labeled.filter(f => f.dedup === 'already-adjudicated')
const inQueue = labeled.filter(f => f.dedup !== 'already-adjudicated')
const roster = inQueue.map(f => f.id + ' — ' + (f.anchorRef || 'absence') + ': ' + f.description).join('\n')

await pipeline(chunk(inQueue, CHUNK_SIZE),
  async (c, _, i) => {
    const r = await agent(findingValidatorPrompt(c),
      { ...tier('decider'), schema: FINDING_VERDICTS_SCHEMA, phase: 'Validate findings', label: 'validate:' + (i + 1) })
    const verdicts = new Map(((r && r.verdicts) || []).map(v => [v.id, v]))
    for (const f of c) {
      const v = verdicts.get(f.id)
      // A dead validator keeps its finding, flagged so routing won't auto-apply it.
      f.unvalidated = !v
      f.findingVerdict = v ? v.verdict : 'finding-validated'
      f.findingReason = v ? v.reason : 'validator result missing — kept unvalidated'
      f.scope = v ? v.scope : 'in-scope'
      // Scope is enforced by the script, not the prompt.
      if (f.scope === 'out-of-scope') {
        f.findingVerdict = 'finding-refuted'
        f.findingReason = 'out of scope — anchored only in context material' + (v && v.reason ? ': ' + v.reason : '')
      }
    }
    return c.filter(f => f.findingVerdict === 'finding-validated')
  },
  async (survivors, _, i) => {
    if (!survivors.length) return survivors
    const props = await agent(proposerPrompt(survivors),
      { ...tier('decider'), schema: PROPOSALS_SCHEMA, phase: 'Propose', label: 'propose:' + (i + 1) })
    const byId = new Map(((props && props.proposals) || []).map(p => [p.id, p]))
    for (const f of survivors) applyProposal(f, byId.get(f.id))
    return survivors
  },
  async (survivors, _, i) => {
    const toValidate = survivors.filter(f => !f.noRepairNeeded)
    if (!toValidate.length) return survivors
    const r = await agent(fixValidatorPrompt(toValidate, roster),
      { ...tier('decider'), schema: FIX_VERDICTS_SCHEMA, phase: 'Validate repairs', label: 'validate-repair:' + (i + 1) })
    const fvs = new Map(((r && r.verdicts) || []).map(v => [v.id, v]))
    for (const f of toValidate) applyFixVerdict(f, fvs.get(f.id))
    return survivors
  },
  // Re-proposal round: a text-error rejection goes back ONCE to a fresh proposer,
  // correction attached, then to a fresh validator. A second rejection of any kind
  // is final; a substance rejection never enters this round.
  async (survivors, _, i) => {
    const textRejected = survivors.filter(f => f.fixVerdict === 'fix-rejected' && f.rejectKind === 'text')
    if (!textRejected.length) return survivors
    for (const f of textRejected) f.firstRejection = f.fixReason
    const props = await agent(reproposerPrompt(textRejected),
      { ...tier('decider'), schema: PROPOSALS_SCHEMA, phase: 'Validate repairs', label: 'repropose:' + (i + 1) })
    const byId = new Map(((props && props.proposals) || []).map(p => [p.id, p]))
    const redrafted = []
    for (const f of textRejected) {
      const p = byId.get(f.id)
      if (!p) { f.rejectKind = 'substance'; f.fixReason = f.firstRejection + ' — re-proposer returned nothing'; continue }
      applyProposal(f, p)
      f.noRepairNeeded = false
      f.reproposed = true
      redrafted.push(f)
    }
    if (!redrafted.length) return survivors
    const r = await agent(fixValidatorPrompt(redrafted, roster),
      { ...tier('decider'), schema: FIX_VERDICTS_SCHEMA, phase: 'Validate repairs', label: 'revalidate-repair:' + (i + 1) })
    const fvs = new Map(((r && r.verdicts) || []).map(v => [v.id, v]))
    for (const f of redrafted) {
      applyFixVerdict(f, fvs.get(f.id))
      if (f.fixVerdict === 'fix-rejected') f.rejectKind = 'substance' // second rejection: no working fix
    }
    return survivors
  })

const survivors = inQueue.filter(f => f.findingVerdict === 'finding-validated')
const refuted = inQueue.filter(f => f.findingVerdict === 'finding-refuted')
log(labeled.length + ' findings — ' + survivors.length + ' validated, ' + refuted.length + ' refuted, ' + shelved.length + ' already adjudicated')

// ── Route every survivor — plain script logic, no agent decides this ─────────

const byId = new Map(survivors.map(f => [f.id, f]))
for (const f of survivors) {
  if (f.noRepairNeeded) { f.route = 'no-repair-needed' }
  else if (f.fixVerdict === 'needs-human') { f.route = 'escalate'; f.questionClass = 'genuine-trade-off' }
  else if (f.fixVerdict === 'fix-rejected') { f.route = 'escalate'; f.questionClass = 'no-working-fix' }
  else if (f.escalateCondition) { f.route = 'escalate'; f.questionClass = 'gate-condition' }
  else if (!f.derivable || (f.readings || []).length > 1 || f.size !== 'quick-fix') { f.route = 'escalate'; f.questionClass = 'intent' }
  else if (f.unvalidated) { f.route = 'escalate'; f.questionClass = 'unvalidated' }
  else { f.route = 'auto-apply' }
}

// Edges route together: a repair whose dependsOn target escalated joins it; one
// invalidatedBy an escalated sibling escalates with it, one invalidatedBy an
// auto-applying sibling is re-grounded by the edit agent (staleAfter).
let routesSettled = false
while (!routesSettled) {
  routesSettled = true
  for (const f of survivors) {
    if (f.route !== 'auto-apply') continue
    for (const id of (f.dependsOn || []).concat(f.invalidatedBy || [])) {
      const t = byId.get(id)
      if (t && t.route === 'escalate') { f.route = 'escalate'; f.questionClass = 'joined'; f.joinedTo = t.id; routesSettled = false; break }
    }
  }
}
for (const f of survivors) {
  if (f.route !== 'auto-apply') continue
  f.staleAfter = (f.invalidatedBy || []).filter(id => byId.get(id) && byId.get(id).route === 'auto-apply')
}

phase('Resolve')

// Order the auto-apply batch by dependsOn edges — dependencies first; edges never block.
const autoApply = survivors.filter(f => f.route === 'auto-apply')
const applyIds = new Set(autoApply.map(f => f.id))
const ordered = []
const pending = autoApply.slice()
while (pending.length) {
  let i = pending.findIndex(f => (f.dependsOn || []).every(d => !applyIds.has(d) || ordered.some(o => o.id === d)))
  if (i < 0) i = 0
  ordered.push(pending.splice(i, 1)[0])
}

let apply = { applied: [], demoted: [] }
if (ordered.length && TRACKER_MECHANICS) {
  apply = (await agent(applyAgentPrompt(ordered), { ...tier('executor'), schema: APPLY_SCHEMA, label: 'edit:auto-apply', phase: 'Resolve' })) ||
    { applied: [], demoted: ordered.map(f => ({ id: f.id, reason: 'edit agent died — check ' + f.location + ' for a partial edit' })) }
} else if (ordered.length) {
  apply = { applied: [], demoted: ordered.map(f => ({ id: f.id, reason: 'no tracker mechanics filled — the manager applies it' })) }
}
for (const a of apply.applied) { const f = byId.get(a.id); if (f) { f.status = 'auto-applied'; f.edit = a } }
for (const d of apply.demoted) {
  const f = byId.get(d.id)
  if (!f) continue
  f.route = 'escalate'; f.questionClass = 'no-working-fix'; f.fixReason = d.reason; f.demotedReason = d.reason
}
// An auto-apply the agent neither applied nor demoted never silently vanishes.
for (const f of ordered) {
  if (f.route === 'auto-apply' && f.status !== 'auto-applied') {
    f.route = 'escalate'; f.questionClass = 'no-working-fix'; f.fixReason = 'edit agent did not report it'; f.demotedReason = f.fixReason
  }
}

const escalated = survivors.filter(f => f.route === 'escalate')
for (const f of escalated) f.status = 'escalated'
for (const f of survivors) if (f.route === 'no-repair-needed') f.status = 'no-repair-needed'

const escalations = escalated.map(f => ({
  id: f.id, defect: f.defect, kind: f.kind, anchorRef: f.anchorRef, anchorQuote: f.anchorQuote,
  description: f.description, citedSources: f.citedSources,
  questionClass: f.questionClass, joinedTo: f.joinedTo || null, escalateCondition: f.escalateCondition || '',
  leaveAloneCost: f.leaveAloneCost, repairKind: f.repairKind, location: f.location, anchorSnippet: f.anchorSnippet,
  replacementText: f.replacementText, readings: f.readings || [], derivedFrom: f.derivedFrom || '',
  fixVerdict: f.fixVerdict, fixReason: f.fixReason, firstRejection: f.firstRejection || null,
  unvalidated: !!f.unvalidated, demotedReason: f.demotedReason || null,
}))

const digest = {
  found: labeled.length,
  refuted: refuted.map(f => ({ id: f.id, reason: f.findingReason })),
  alreadyAdjudicated: shelved.map(f => ({ id: f.id, prior: f.dedupRef })),
  noRepairNeeded: survivors.filter(f => f.status === 'no-repair-needed').map(f => ({ id: f.id, description: f.description })),
  autoApplied: survivors.filter(f => f.status === 'auto-applied').map(f => ({ id: f.id, description: f.description, derivedFrom: f.derivedFrom, location: f.edit.location, before: f.edit.before, after: f.edit.after })),
  reproposed: survivors.filter(f => f.reproposed).map(f => ({ id: f.id, firstRejection: f.firstRejection, outcome: f.status })),
  escalatedByClass: escalated.reduce((m, f) => { m[f.questionClass] = (m[f.questionClass] || 0) + 1; return m }, {}),
  incomplete: incomplete,
}

// Pending-questions post — the workflow's final stage, per /finding-pipeline's The gate.
let ledger = { posted: false, marker: 'no escalations — no pending-questions post needed' }
if (escalations.length) {
  ledger = TRACKER_MECHANICS
    ? (await agent(ledgerPrompt(escalations, digest), { ...tier('decider'), schema: LEDGER_SCHEMA, label: 'ledger:pending-questions', phase: 'Resolve' })) ||
      { posted: false, marker: 'ledger agent died — POST THE PENDING-QUESTIONS COMMENT FROM THE MANAGER before anything else' }
    : { posted: false, marker: 'no tracker mechanics filled — post the pending-questions comment from the manager before the loop' }
}

if (incomplete.length) log('FIND STAGE INCOMPLETE — ' + incomplete.join('; ') + '. A clean result here is not a clean review.')
log('Routing: ' + digest.autoApplied.length + ' auto-applied, ' + digest.noRepairNeeded.length + ' no-repair-needed, ' + escalations.length + ' escalated')

// The full routed queue — all the manager ever sees of this pipeline.
return {
  queue: survivors,
  refuted: refuted,
  shelved: shelved,
  autoApplied: digest.autoApplied,
  escalations: escalations,
  digest: digest,
  ledger: ledger,
  incomplete: incomplete,
}
