export const meta = {
  name: 'ship-wave',
  description: 'One ship wave: claim ∥ plan → collision check → implement in worktrees → merge in completion order → verify the merged diff → route — escalate intent, auto-resolve code',
  phases: [
    { title: 'Claim + Plan', detail: 'executor-tier claim agent alongside one decider-tier planner per ticket; collision check over the finished plans' },
    { title: 'Implement', detail: 'one executor-tier implementer per ticket, each in an isolated worktree' },
    { title: 'Merge', detail: 'strictly serialized executor-tier merges in implementer-completion order; tests after each' },
    { title: 'Review', detail: 'spec + standards reviewers over the merged wave diff (closing pass: sweeper + requirements union)' },
    { title: 'Label', detail: 'normalize into IDed findings; dedup vs open tickets and the ledger' },
    { title: 'Validate findings', detail: 'fresh adversarial validators, chunked — refuted findings leave here' },
    { title: 'Propose', detail: 'one proposer per chunk over its surviving findings' },
    { title: 'Validate fixes', detail: 'fresh adversarial validators, chunked; pair resolution' },
    { title: 'Resolve', detail: 'script routing; fix agent applies, ticket agent files, ledger stage posts pending questions' },
  ],
}

// Template for the /ship wave workflow — SKILL.md's "The wave workflow" and "What
// is local to this gate" hold the stage briefs this file encodes, and
// /finding-pipeline (code gates included) holds the invariants; keep them in
// sync when any changes. The same file runs the closing pass (set CLOSING).
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch — loud,
// before any agent spawns. Fill prose slots as JSON string literals (double
// quotes, \n escapes): mechanical to produce, and immune to the backticks and
// apostrophes that terminate template literals and single-quoted strings.
// Nothing goes through `args` — ever.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const WAVE = FILL                 // wave number n — or the closing-pass number k when CLOSING
const CLOSING = FILL              // false for a wave; for a closing pass: { deferredQueue: [...] } — the ledger's deferred-to-close blocks, verbatim ([] if none)
const SHIP_BRANCH = FILL          // the run's branch, e.g. "spec-42-auth-rework"
const PRE_WAVE_SHA = FILL         // HEAD of the ship branch at launch — before this wave's first merge; the run base (merge-base with default) when CLOSING
const TICKETS = FILL              // [{ ref: "#57", title, body, decisionIds: ["D-3"] }] — the frontier; [] when CLOSING
const SPEC_ISSUE_REF = FILL       // tracker ref of the spec issue, e.g. "#42"
const SPEC_KERNEL = FILL          // the spec kernel verbatim — Testing Decisions, Seams under test, Decision Index included
const DECISIONS = FILL            // { "D-3": "full decision text", ... } — union of decisions the wave's tickets cite ({} when CLOSING: reviewers fetch by ID)
const TRACKER_READ_OP = FILL      // one-liner: how an agent fetches a spec decision by ID, or ""
const STANDARDS_SOURCES = FILL    // [{ path: "CONVENTIONS.md", scope: "repo root" }, ...] — [] omits the standards axis entirely ("standards axis idle")
const OPEN_REVIEW_TICKETS = FILL  // pre-fetched open review-finding tickets: [{ ref, title, body }] — [] if none
const PRIOR_LEDGER_SUMMARIES = FILL // pre-fetched prior wave/closing summary comments (adjudication memory): ["..."] — [] if none
const PRIOR_ANSWERS = FILL        // pre-fetched answer record — prior w<n>-answer comments and verdict-posted spec comments, verbatim: ["..."] — [] if none; binding spec text for classification
const TRACKER_MECHANICS = FILL    // prose: the tracker's claim/unclaim/close/comment/create/label/parent operations per /issue-tracker (exact commands)
const WIDE = FILL                 // true past ~15 files / ~1,500 changed lines expected → partitioned review
const TEST_NOTES = FILL           // how to run the suite / typecheck / affected tests, or "" to let agents discover

const EXECUTOR_MODEL = FILL    // per /model-policy: the executor tier's resolved model ('sonnet'), or null to inherit the session model
const DECIDER_MODEL = FILL     // per /model-policy: the decider tier's resolved model ('opus'), or null to inherit — never leave a fan-out on the session's model by accident
const AUDITOR_MODEL = FILL     // per /model-policy: the auditor tier's resolved model ('fable') for the run-once find-side reads, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the run genuinely deviates ═══════════

const CHUNK_SIZE = 5 // findings per chunk — an axis's findings flow through validate → propose → validate-fix in chunks, each chunk an independent pipeline chain

// Model tiers per /model-policy: every agent() call names its tier; a pinned tier passes
// `model`, an inherited one (null slot) passes nothing and takes the harness default.
const TIER_MODEL = { executor: EXECUTOR_MODEL, decider: DECIDER_MODEL, auditor: AUDITOR_MODEL }
const tier = t => (TIER_MODEL[t] ? { model: TIER_MODEL[t] } : {})

const PREFIX = (CLOSING ? 'C' : 'W') + WAVE
const DIFF_CMD = 'git diff ' + PRE_WAVE_SHA + '...HEAD'
const LOG_CMD = 'git log ' + PRE_WAVE_SHA + '..HEAD'

const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')

// The contract's scope rule, stated once here and folded into the block every review-side
// stage shares, so reviewers, labelers, and validators read the same words. Canonical
// wording: /finding-pipeline, "The diff is the material" — edit there first, then here.
const SCOPE_RULE = 'SCOPE — the diff is the material. A finding must name something the diff DID: a line it added, changed, or removed. Code the diff never touched is out of scope however wrong it is, and whether or not a ticket already covers it. You will legitimately see far more code than you may report on — diff context lines, the repo grep behind a repo-wide flag, the files you open to check a rule — and none of it is reportable on its own. Two cases are in scope and only look like exceptions: a requirement this change was meant to deliver and did not (an absence has no anchor), and the repo-wide counts, which are evidence about a pattern the diff instantiates, never findings about the untouched instances.'

// Commits are created inside this run — agents fetch the log themselves.
const COMMON = j([
  SCOPE_RULE,
  'Ship branch: ' + SHIP_BRANCH + '. Diff under review (run it yourself): ' + DIFF_CMD,
  'Commits under review: run ' + LOG_CMD + ' yourself — full messages, they carry deviation notes.',
])

const SPEC_CONTEXT = j([
  'Spec kernel (spec issue ' + SPEC_ISSUE_REF + ') — Testing Decisions, Seams under test, and the Decision Index included; index one-liners stand in for every decision not given in full below:',
  SPEC_KERNEL,
  Object.keys(DECISIONS).length
    ? 'Full text of the decisions this wave\'s tickets cite:\n' + Object.keys(DECISIONS).map(d => '### ' + d + '\n' + DECISIONS[d]).join('\n\n')
    : null,
  TRACKER_READ_OP ? 'To fetch an uncited decision by ID: ' + TRACKER_READ_OP : null,
  PRIOR_ANSWERS.length
    ? 'Owner answers from earlier waves — BINDING spec text, same authority as a decision; a finding one of these directly governs diverges from the answer, it does not raise a new question:\n' + PRIOR_ANSWERS.join('\n---\n')
    : null,
])

const AXIS_INPUTS = j([
  STANDARDS_SOURCES.length
    ? 'Standards sources (read the files yourself; a scoped CONVENTIONS.md governs only files under its directory, nearest scope winning; scoped files read as deltas over root):\n' +
      STANDARDS_SOURCES.map(s => '- ' + s.path + ' — binds ' + s.scope).join('\n')
    : 'No documented standards — the standards axis is idle this wave.',
  SPEC_CONTEXT,
])

// ── Schemas ──────────────────────────────────────────────────────────────────

const CLAIM_SCHEMA = {
  type: 'object', required: ['claimed', 'failed'],
  properties: {
    claimed: { type: 'array', items: { type: 'string' }, description: 'ticket refs successfully claimed and verified' },
    failed: { type: 'array', items: { type: 'object', required: ['ref', 'reason'], properties: { ref: { type: 'string' }, reason: { type: 'string' } } } },
  },
}

const PLAN_SCHEMA = {
  type: 'object', required: ['status', 'plan', 'files', 'seams'],
  properties: {
    status: { enum: ['planned', 'parked'] },
    plan: { type: 'string', description: 'the implementation plan as posted to the ticket; the park reason when parked' },
    files: { type: 'array', items: { type: 'string' }, description: 'files the work is expected to change' },
    seams: { type: 'array', items: { type: 'string' }, description: 'seams the work will touch or reshape' },
  },
}

const COLLISION_SCHEMA = {
  type: 'object', required: ['amendments', 'mergeNotes'],
  properties: {
    amendments: { type: 'array', items: { type: 'object', required: ['ref', 'amendment'], properties: { ref: { type: 'string' }, amendment: { type: 'string', description: 'the amended shape, also posted as a follow-up plan comment on the ticket' } } } },
    mergeNotes: { type: 'array', items: { type: 'string' }, description: 'tensions that could not be reconciled mechanically — baked into the merge briefs' },
  },
}

const IMPL_SCHEMA = {
  type: 'object', required: ['status', 'branch', 'notes'],
  properties: {
    status: { enum: ['done', 'parked'] },
    branch: { type: 'string', description: 'the worktree branch holding the commits (git rev-parse --abbrev-ref HEAD); "" when parked' },
    notes: { type: 'string', description: 'deviations from the plan, or the park reason' },
  },
}

const MERGE_SCHEMA = {
  type: 'object', required: ['status', 'sha', 'testSummary'],
  properties: {
    status: { enum: ['merged', 'parked'] },
    sha: { type: 'string', description: 'ship-branch HEAD after the merge; "" when parked' },
    testSummary: { type: 'string' },
  },
}

const FINDING_FIELDS = {
  id: { type: 'string' },
  kind: { enum: ['in-diff', 'absence'], description: 'absence = something the change was meant to deliver and did not; it has no code to point at, so file is "" and lineStart/lineEnd are 0. Everything else is in-diff.' },
  file: { type: 'string', description: '"" when kind=absence — never invent an anchor for something that is not there' },
  lineStart: { type: 'integer', description: '0 when kind=absence' },
  lineEnd: { type: 'integer', description: '0 when kind=absence' },
  description: { type: 'string', description: 'one line' },
  repoWide: { type: 'boolean' },
  repoWideEvidence: { type: 'string', description: 'the grep plus both counts, or ""' },
  citedSource: {
    type: 'object', required: ['title', 'gist', 'quote', 'id'],
    description: 'the standard rule or spec decision the finding holds the code against — prose fields the cold-reader assembler writes from; the id is a record handle, never the only thing carried',
    properties: {
      title: { type: 'string', description: 'the rule or decision title' },
      gist: { type: 'string', description: 'one line: what it requires, in the domain\'s terms' },
      quote: { type: 'string', description: 'the quoted rule or spec sentence the finding turns on' },
      id: { type: 'string', description: 'decision ID or CONVENTIONS.md path' },
    },
  },
  dedup: { enum: ['none', 'already-ticketed', 'instance-of-open', 'possibly-duplicates', 'already-adjudicated'] },
  dedupRef: { type: 'string', description: 'ticket #N or the prior outcome; "" when dedup=none' },
}
const FINDINGS_SCHEMA = {
  type: 'object', required: ['findings'],
  properties: { findings: { type: 'array', items: { type: 'object', required: Object.keys(FINDING_FIELDS), properties: FINDING_FIELDS } } },
}

const FINDING_VERDICT_FIELDS = {
  id: { type: 'string' },
  verdict: { enum: ['finding-validated', 'finding-refuted'] },
  reason: { type: 'string' },
  scope: { enum: ['introduced-by-diff', 'missing-requirement', 'pre-existing'], description: 'settled BEFORE the merits: pre-existing = the subject is code the diff never touched, and the script refutes it whatever its merits' },
  specClassification: { enum: ['code-diverges', 'spec-suspect', 'n/a'] },
  repoWideRaised: { type: 'boolean' },
  repoWideEvidence: { type: 'string' },
}
const FINDING_VERDICTS_SCHEMA = {
  type: 'object', required: ['verdicts'],
  properties: { verdicts: { type: 'array', items: { type: 'object', required: Object.keys(FINDING_VERDICT_FIELDS), properties: FINDING_VERDICT_FIELDS } } },
}

const PROPOSAL_FIELDS = {
  id: { type: 'string' },
  fix: { type: 'string', description: 'what to change, where — anchored by file + a short quoted snippet, never a bare line number' },
  sketch: { type: 'string', description: 'a sketch of the changed code — not a full patch' },
  size: { enum: ['quick-fix', 'needs-a-session'] },
  docOnly: { type: 'boolean', description: 'true only when the entire fix lives in comments, docs, or headers — no executable code changes' },
}
const PROPOSALS_SCHEMA = {
  type: 'object', required: ['proposals'],
  properties: { proposals: { type: 'array', items: { type: 'object', required: Object.keys(PROPOSAL_FIELDS), properties: PROPOSAL_FIELDS } } },
}

const FIX_VERDICT_FIELDS = {
  id: { type: 'string' },
  verdict: { enum: ['validated', 'fix-rejected', 'needs-human'] },
  reason: { type: 'string' },
  docOnly: { type: 'boolean', description: 'confirm or clear the proposal\'s claim — final word; true only when the fix touches no executable code' },
  repoWide: { type: 'boolean' },
  instancesInDiff: { type: 'integer' },
  instancesOutsideDiff: { type: 'integer' },
  dependsOn: { type: 'array', items: { type: 'string' } },
  invalidatedBy: { type: 'array', items: { type: 'string' } },
}
const FIX_VERDICTS_SCHEMA = {
  type: 'object', required: ['verdicts'],
  properties: { verdicts: { type: 'array', items: { type: 'object', required: Object.keys(FIX_VERDICT_FIELDS), properties: FIX_VERDICT_FIELDS } } },
}

const PAIR_SCHEMA = {
  type: 'object', required: ['resolution', 'reason'],
  properties: {
    resolution: { enum: ['agreeing', 'competing'], description: 'agreeing = both fixes can land (compatible or identical in effect); competing = they cannot both land' },
    reason: { type: 'string' },
  },
}

const PARTITION_SCHEMA = {
  type: 'object', required: ['groups', 'requirements'],
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object', required: ['name', 'paths', 'decisionIds'],
        properties: {
          name: { type: 'string' },
          paths: { type: 'array', items: { type: 'string' } },
          decisionIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    requirements: { type: 'array', items: { type: 'string' }, description: 'the spec\'s discrete requirements as short strings' },
  },
}

const SPEC_REVIEW_SCHEMA = {
  type: 'object', required: ['report', 'requirementsTouched'],
  properties: {
    report: { type: 'string' },
    requirementsTouched: { type: 'array', items: { type: 'string' } },
  },
}

const CHECKER_SCHEMA = {
  type: 'object', required: ['status', 'note'],
  properties: {
    status: { enum: ['implemented-pre-existing', 'implemented-in-diff', 'missing', 'partial'] },
    note: { type: 'string', description: 'one line of evidence' },
  },
}

const APPLY_SCHEMA = {
  type: 'object', required: ['applied', 'demoted', 'testSummary'],
  properties: {
    applied: { type: 'array', items: { type: 'object', required: ['id', 'sha'], properties: { id: { type: 'string' }, sha: { type: 'string' } } } },
    demoted: {
      type: 'array',
      items: {
        type: 'object', required: ['id', 'reason', 'kind'],
        properties: {
          id: { type: 'string' },
          reason: { type: 'string' },
          kind: { enum: ['preconditions', 'test-failure', 'other'], description: 'preconditions → the finding auto-tickets instead; test-failure/other → it escalates as no-working-fix' },
        },
      },
    },
    testSummary: { type: 'string' },
  },
}

const TICKET_SCHEMA = {
  type: 'object', required: ['tickets'],
  properties: {
    tickets: {
      type: 'array',
      items: {
        type: 'object', required: ['ref', 'title', 'findingIds'],
        properties: {
          ref: { type: 'string' },
          title: { type: 'string' },
          findingIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const LEDGER_SCHEMA = {
  type: 'object', required: ['posted', 'marker'],
  properties: {
    posted: { type: 'boolean' },
    marker: { type: 'string', description: 'the comment marker used, or the failure reason when posted=false' },
  },
}

// ── Prompt builders — wave stages ────────────────────────────────────────────

function claimPrompt() {
  return j([
    'You are the claim agent of a ship wave — pure tracker mechanics, no code. Claim every frontier ticket below (bootstrap the claim markers first if needed) and verify each claim check passes.',
    'Tracker operations:',
    TRACKER_MECHANICS,
    'Tickets to claim:',
    JSON.stringify(TICKETS.map(t => ({ ref: t.ref, title: t.title }))),
  ])
}

function plannerPrompt(t) {
  return j([
    'You are the planner for one ticket of ship wave ' + WAVE + ' on branch ' + SHIP_BRANCH + '. Explore the branch as it stands NOW and write the ticket\'s implementation plan: where the work lands, the approach, the seams it will touch, the files it expects to change, and where the red tests go first. You get exactly what your implementer will get.',
    SPEC_CONTEXT,
    'Your ticket (' + t.ref + ' — ' + t.title + '):',
    t.body,
    'Post the finished plan as a comment on the ticket, opening with the marker <!-- ship wave-' + WAVE + ' plan -->. Tracker operations:',
    TRACKER_MECHANICS,
    'If the ticket cannot be built as written — a decision the spec does not hold, work no listed seam covers — PARK it instead of planning around the gap: unclaim the ticket, comment what is missing on the ticket, comment the gap on spec issue ' + SPEC_ISSUE_REF + ', and return status=parked with the reason.',
  ])
}

function collisionPrompt(planned, overlaps) {
  return j([
    'You are the collision check of ship wave ' + WAVE + '. Parallel implementers are about to build these plans against the same branch; reconcile pairs that plan to reshape the same seam differently. A seam is not a file — watch for plans converging on the same interface, duplicating the same helper, or shaping the same contract even in disjoint files.',
    'Precomputed file overlaps (a focus aid, not the whole story):',
    overlaps.length ? overlaps.map(o => '- ' + o).join('\n') : '- none — check seam-level convergence anyway',
    'The plans:',
    JSON.stringify(planned.map(p => ({ ref: p.t.ref, title: p.t.title, plan: p.plan.plan, files: p.plan.files, seams: p.plan.seams }))),
    'Where one shape can serve both, amend the losing plan: return the amendment AND post it as a follow-up plan comment on that ticket (marker <!-- ship wave-' + WAVE + ' plan -->). Tracker operations:',
    TRACKER_MECHANICS,
    'What you cannot reconcile mechanically becomes a mergeNote — the merge agent inherits the tension, never the human.',
  ])
}

function implementerPrompt(t, plan, amendment) {
  return j([
    'You are the implementer for one ticket of ship wave ' + WAVE + ', working in an ISOLATED WORKTREE. First action: confirm the ticket carries in-progress (tracker operations below). Never touch any other ticket.',
    SPEC_CONTEXT,
    'Your ticket (' + t.ref + ' — ' + t.title + '):',
    t.body,
    'Your wave-stamped plan:',
    plan.plan,
    amendment ? 'Collision-check amendment — build against this shared shape:\n' + amendment : null,
    'Discipline (/implement + /tdd): red–green at the spec\'s seams — red test first, then the code that greens it; typecheck regularly; run single test files regularly; commit in your worktree as you go.',
    TEST_NOTES ? 'Test/typecheck commands: ' + TEST_NOTES : null,
    'The plan is a map, not a contract: if the code contradicts it, deviate and note the deviation in a ticket comment — the territory wins. If you need an uncited decision, check the Decision Index and fetch it by ID, noting the missed routing in a ticket comment.',
    'If the ticket cannot be built — a decision the spec holds nowhere, work no listed seam covers — PARK: unclaim, comment what is missing on the ticket, comment the gap on spec issue ' + SPEC_ISSUE_REF + ', return status=parked.',
    'Tracker operations:',
    TRACKER_MECHANICS,
    'When done: report your worktree branch (git rev-parse --abbrev-ref HEAD) — the merge agent needs it.',
  ])
}

function mergePrompt(t, branch, mergeNotes) {
  return j([
    'You are a merge agent of ship wave ' + WAVE + ', working in the MAIN checkout. Merge worktree branch ' + branch + ' (ticket ' + t.ref + ') into ' + SHIP_BRANCH + '. Verify you are on ' + SHIP_BRANCH + ' first.',
    mergeNotes.length ? 'Unreconciled collision notes from the plan stage — you inherit these tensions:\n' + mergeNotes.map(n => '- ' + n).join('\n') : null,
    'On conflict, resolve preserving BOTH tickets\' intent, then re-test. After the merge run the affected tests (full suite if cheap).',
    TEST_NOTES ? 'Test commands: ' + TEST_NOTES : null,
    'NEVER merge on red: a branch that cannot come green is parked — abort/revert the merge so ' + SHIP_BRANCH + ' stays green, comment the failure on the ticket, return status=parked.',
    'On green: close the ticket with a comment linking its commits, remove in-progress. Tracker operations:',
    TRACKER_MECHANICS,
  ])
}

// ── Prompt builders — verification pipeline ──────────────────────────────────

function partitionPrompt(fileList) {
  return j([
    'You are the partition stage of a wide wave review. Read the changed-file list below — not the full diff.',
    fileList,
    STANDARDS_SOURCES.length
      ? 'Standards-scope map (align groups with these boundaries where possible):\n' + STANDARDS_SOURCES.map(s => '- ' + s.path + ' — binds ' + s.scope).join('\n')
      : null,
    SPEC_CONTEXT,
    'Cluster the changed files into logical groups by subsystem or directory. Every changed file lands in exactly one group. Route spec decision IDs to the group whose files answer them (decisionIds per group).',
    'Also enumerate the spec\'s discrete requirements as short strings in `requirements` — the requirement-coverage union check needs them.',
  ])
}

function standardsReviewerPrompt(g) {
  return j([
    'You are the Standards reviewer of a ship wave verification: does the merged wave diff break a DOCUMENTED standard? This is a verification gate, not a taste review.',
    COMMON,
    g.paths ? 'Your slice: ' + g.name + '. Path-scoped diff command: ' + g.diffCmd : null,
    'Standards sources (read the files yourself; a scoped CONVENTIONS.md governs only files under its directory, nearest scope winning; scoped files read as deltas over root):\n' +
      STANDARDS_SOURCES.map(s => '- ' + s.path + ' — binds ' + s.scope).join('\n'),
    'Report — per file/hunk where relevant — every place the diff violates a WRITTEN rule: cite the standard (file + rule) for each. If no written rule covers something, it is not a finding — do not report taste, smells, or conventions you would personally prefer. A finding that looks like a pattern with a statable grep signature: grep outside the diff and flag repo-wide only with the grep and both counts attached. Skip anything tooling enforces. Under 300 words.',
    'Your final text IS the report.',
  ])
}

function specSliceContext(g) {
  if (!g.paths || !g.decisionIds) return SPEC_CONTEXT
  const routed = g.decisionIds.filter(d => d in DECISIONS)
  return j([
    'Spec kernel (spec issue ' + SPEC_ISSUE_REF + ') — index one-liners stand in for every decision not given in full below, so scope creep stays checkable against the whole decision surface:',
    SPEC_KERNEL,
    routed.length
      ? 'Full text of the decisions routed to your group:\n' + routed.map(d => '### ' + d + '\n' + DECISIONS[d]).join('\n\n')
      : 'No decisions were routed to your group.',
    TRACKER_READ_OP ? 'If a hunk looks like it answers an UNROUTED decision, fetch it by ID: ' + TRACKER_READ_OP : null,
  ])
}

function specReviewerPrompt(g) {
  return j([
    'You are the Spec reviewer of a ship wave verification: did the wave\'s tickets deliver their acceptance criteria? You review the INTEGRATED wave — how parallel tickets compose — not each ticket alone.',
    COMMON,
    g.paths ? 'Your slice: ' + g.name + '. Path-scoped diff command: ' + g.diffCmd : null,
    specSliceContext(g),
    'The wave\'s tickets:',
    JSON.stringify(TICKETS.map(t => ({ ref: t.ref, title: t.title, body: t.body }))),
    'Report: (a) acceptance criteria of THIS WAVE\'S TICKETS (listed above) that are missing or partial — a requirement no ticket in this wave carries is a later wave\'s work, not a finding; (b) behaviour not asked for (scope creep); (c) requirements implemented wrong. Treat decision snippets — state machines, schemas, contracts — as requirements; divergence from one is a finding. Where the spec is SILENT on a case the diff had to decide, that is not a violation — report it as a spec question only when a different owner could defensibly want a different behaviour; silence plus one defensible choice is not a question. State the case and the choice the code made. Quote the spec line, with its decision ID where it has one, per finding. Under 400 words.',
    'Also fill requirementsTouched: the spec requirements your slice\'s files touch (whether or not you found problems with them).',
  ])
}

function sweeperPrompt(kind) {
  return j([
    kind === 'closing'
      ? 'You are the cross-wave sweeper of a ship closing pass. Per-wave verification is a partition in time, blind to seams BETWEEN waves — parallel agents that never saw each other\'s code converging on the same shapes. You read the whole run diff.'
      : 'You are the in-wave cross-cutting sweeper of a partitioned wave review. Chunk reviewers each see one group; four smells span groups by nature, and only you can see them.',
    COMMON,
    'Read the diff at low resolution — file list and hunk headers, reading closer only where something looks suspicious. Hunt ONLY four cross-file composition seams (Fowler, Refactoring ch.3): Duplicated Code, Repeated Switches, Shotgun Surgery, Divergent Change. The target is parallel-implementation drift, not style. Report each hit: name the smell, quote the hunks involved. Every hit is a hypothesis for the validators. Under 300 words.',
    'Your final text IS the report.',
  ])
}

function requirementsUnionPrompt() {
  return j([
    'You are the requirements-union check of a ship closing pass. Read the spec kernel with its full Decision Index against the whole run diff\'s FILE LIST (not the full diff) and list every requirement you suspect is implemented nowhere. Fetch decisions by ID as needed.',
    COMMON,
    SPEC_CONTEXT,
    'Return only the suspects, one short line each — each goes to a small checker agent before becoming a finding. Absent from the changed files does NOT prove unimplemented; err toward listing a suspect over silence.',
    'Your final text IS the suspect list, one per line (empty if none).',
  ])
}

function checkerPrompt(q) {
  return j([
    'One spec requirement is suspected unimplemented. Requirement: ' + q,
    COMMON,
    'Check whether it is implemented. Absent from the changed files does NOT mean unimplemented — it may pre-exist; search the repo before you call it missing.',
  ])
}

function labelPrompt(axisPrefix, axisName, reports) {
  return j([
    'You are the labeling stage of a ship wave verification — normalize raw reviewer reports into a list of discrete findings (light cleaning, no re-reviewing).',
    SCOPE_RULE,
    'Axis: ' + axisName + '. Assign IDs ' + PREFIX + '-' + axisPrefix + '-1, ' + PREFIX + '-' + axisPrefix + '-2, ... in report order.',
    'Reviewer reports:',
    reports.map((r, i) => '--- report ' + (i + 1) + ' ---\n' + r).join('\n'),
    reports.length > 1 ? 'Reports overlap — dedup across report boundaries: one finding per underlying defect.' : null,
    'Set kind on each finding: absence for anything a coverage or requirements check reported as implemented nowhere (file "", lineStart 0, lineEnd 0 — do NOT invent an anchor for code that does not exist), in-diff for everything else.',
    'Each finding carries: file + lineStart/lineEnd anchoring it, a one-line description, the repo-wide flag where a reviewer raised it (carry its grep evidence), and the cited source as three prose fields — its title, a one-line gist of what it requires, and the quoted sentence the finding turns on — plus its ID as a handle.',
    'Dedup against the open review-finding tickets below. Match conservatively — a standalone cleanup ticket matches at the rule/pattern level; a spec-child ticket matches only same file + same rule:',
    JSON.stringify(OPEN_REVIEW_TICKETS),
    '- Subject predates this diff (visible in context, not introduced by the change) and matches an open ticket → dedup=already-ticketed, dedupRef=#N. An unticketed pre-existing subject is not yours to shelve — carry it; the finding validator refutes it on scope.',
    '- Introduced by this diff but matches a ticketed pattern → dedup=instance-of-open, dedupRef=#N (stays in — new instances of a known pattern are new debt).',
    '- Uncertain match → dedup=possibly-duplicates, dedupRef=#N (stays in). A visible duplicate is recoverable; a silent suppression is not.',
    'Dedup against the run\'s adjudication memory — every finding adjudicated in one of these ledger summaries (auto-applied, auto-ticketed, answered, deferred, refuted, reverted, or left as-is) is already decided → dedup=already-adjudicated, dedupRef=the prior outcome:',
    JSON.stringify(PRIOR_LEDGER_SUMMARIES),
  ])
}

function findingValidatorPrompt(axisName, findings) {
  return j([
    'You are a fresh adversarial validator in a ship wave verification. You did not author these findings; your job is to try to REFUTE each one, on its own — no fix exists yet.',
    COMMON,
    AXIS_INPUTS,
    'Findings to validate (axis: ' + axisName + '):',
    JSON.stringify(findings.map(f => ({ id: f.id, kind: f.kind, file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd, description: f.description, repoWide: f.repoWide, citedSource: f.citedSource }))),
    'Per finding, answer one question: is the finding real? Read the cited source and the actual hunk — does the rule or spec line say what the reviewer claims, does the code actually breach it, and does the claimed harm survive what the compiler and tooling already guarantee? verdict=finding-refuted (with the reason) or finding-validated.',
    'Settle SCOPE first, before the merits, and return it as the scope field: introduced-by-diff (the hunk it anchors to is a line this diff added, changed, or removed), missing-requirement (an absence — something this change was meant to deliver and did not), or pre-existing (the subject is code this diff never touched, however wrong it is). A pre-existing finding is refuted on scope no matter how real it is — check the anchor against the diff yourself rather than trusting the reviewer.',
    'A finding with kind=absence has no anchor by construction: its scope is missing-requirement if the thing really is implemented nowhere, and finding-refuted if you find it implemented — never pre-existing.',
    axisName === 'Spec'
      ? 'Also classify each finding: code-diverges or spec-suspect, decided by ONE test — would the owner\'s answer change the fix? spec-suspect ONLY when: (a) two or more defensible readings call for different behaviour, (b) commit messages or tests show a deliberate deviation, or (c) the spec\'s own statements collide. Spec silence alone is NOT doubt: a defect with one defensible minimal fix — a visible bug, a wrong comment, dead code the diff itself added — is code-diverges even where the spec never speaks. Owner answers from earlier waves (in the spec context above) are BINDING spec text: a finding one directly governs is code-diverges from that answer, never a re-ask. Where real behavioural doubt survives the test → spec-suspect — a false spec-suspect costs one human glance; a false code-diverges silently rewrites behaviour.'
      : 'specClassification is n/a on this axis.',
    axisName === 'Standards'
      ? 'You may set repoWideRaised on a finding whose pattern the reviewer missed — only with the grep and both counts (inside and outside the diff) in repoWideEvidence.'
      : null,
  ])
}

function proposerPrompt(axisName, survivors) {
  return j([
    'You are a ' + axisName + ' fix proposer of a ship wave verification. Every finding below survived adversarial validation; the finding\'s reality is settled.',
    COMMON,
    AXIS_INPUTS,
    'Validated findings, each with its validator\'s reasoning:',
    JSON.stringify(survivors.map(f => ({ id: f.id, kind: f.kind, file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd, description: f.description, citedSource: f.citedSource, specClassification: f.specClassification, validatorReasoning: f.findingReason }))),
    'For each finding, propose the smallest concrete fix that resolves it: what to change, where — anchor by file plus a short quoted snippet of the code being changed, not a bare line number (lines drift once fixes start landing) — and a short sketch of the changed code — a sketch, not a full patch. Size each fix: quick-fix (a few edits) or needs-a-session (a fresh context window\'s worth of work). Set docOnly=true only where the ENTIRE fix lives in comments, docs, or headers — no executable code changes. Keep each proposal under 100 words.',
    axisName === 'Spec' ? 'A spec-suspect finding gets a fix sketch per plausible reading where that is cheap — the user\'s answer will pick one.' : null,
  ])
}

function fixValidatorPrompt(axisName, items, roster) {
  return j([
    'You are a fresh adversarial fix validator in a ship wave verification — not the proposer, and not the finding validator. Your job is to try to REFUTE each fix.',
    COMMON,
    AXIS_INPUTS,
    'Proposals to validate (axis: ' + axisName + '; each with its finding and the finding-validator\'s reasoning):',
    JSON.stringify(items.map(f => ({ id: f.id, file: f.file, description: f.description, citedSource: f.citedSource, findingReasoning: f.findingReason, proposal: f.proposal, sketch: f.sketch, size: f.size, repoWide: f.repoWide, repoWideEvidence: f.repoWideEvidence }))),
    'Every finding in this axis, for the edge fields below — dependsOn / invalidatedBy may name IDs outside your batch:',
    roster,
    'Per proposal, check: (1) does the fix actually resolve the finding? (2) is it proportionate — the minimal change that clears the finding, no speculative rewrites? (3) cross-axis: a fix for a Spec finding must not introduce a Standards violation, and a Standards fix must not change behaviour the spec asked for. (4) re-settle the repo-wide flag: run the grep yourself, then drop every instance the cited rule does not actually govern — apply the rule\'s own scope and any grandfather clause (a rule binding only new-and-edited files never counts untouched files) — and fill instancesInDiff / instancesOutsideDiff with the GOVERNED counts only; the flag holds only when instancesOutsideDiff > 0. Your call on the flag is final downstream. (5) confirm or clear docOnly — final word: true only when the fix touches no executable code. A validated docOnly quick-fix on a spec-suspect finding auto-applies instead of escalating, so confirm it only when the code\'s current behaviour is right and only the record about it is wrong.',
    'Verdict per proposal: validated, fix-rejected (with the reason), or needs-human (a genuine trade-off the user must call). The finding\'s reality is NOT on the table — that was settled upstream; record any lingering doubt inside a fix-rejected reason.',
    'Fill the edge fields instead of burying edges in prose: dependsOn = IDs whose fixes must land for this one to work; invalidatedBy = IDs whose accepted fix makes this proposal\'s premise or wording false.',
  ])
}

function pairPrompt(a, b) {
  return j([
    'Two findings from different axes of a ship wave verification anchor to the same code — usually one defect wearing two labels — and each carries a fix proposal that survived adversarial validation. Decide whether the two fixes AGREE (compatible or identical in effect — both can land, or one subsumes the other) or COMPETE (they cannot both land).',
    COMMON,
    AXIS_INPUTS,
    'The pair:',
    JSON.stringify([a, b].map(f => ({ id: f.id, file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd, description: f.description, citedSource: f.citedSource, proposal: f.proposal, sketch: f.sketch }))),
  ])
}

function fixAgentPrompt(batch) {
  return j([
    'You are the auto-apply fix agent of a ship wave — working alone in the MAIN checkout on branch ' + SHIP_BRANCH + '. Apply the batch below IN ORDER, one commit per finding ID, message format: review: <ID> — <one-liner>. An agreeing cross-axis pair (pairWith set on both members) applies as ONE commit covering both IDs — review: <ID>+<ID> — <one-liner>: when you reach the first member, apply both together and skip the partner when its turn comes.',
    'FIRST ACT — re-derive both preconditions yourself; never trust values threaded through this prompt:',
    '- git status --porcelain → if the tree is dirty, apply NOTHING: demote every finding, kind=preconditions, reason "demoted: dirty tree". Never commit around uncommitted work.',
    '- git rev-parse --abbrev-ref HEAD → if HEAD is not ' + SHIP_BRANCH + ', apply NOTHING: demote everything, kind=preconditions, reason "demoted: not on the ship branch".',
    '- If a precondition cannot be verified at all, demote with kind=preconditions, reason "demoted: couldn\'t verify preconditions" — the distinct wording matters; only that one is a bug to chase.',
    'Anchor each edit by the proposal\'s quoted snippet, never by line number. A finding whose staleAfter lists earlier IDs: those fixes may have invalidated this proposal\'s premise — re-ground it against the code as it now stands before applying; if it no longer holds, demote it, kind=other, saying why.',
    'After the whole batch: run the full test suite once; revert any finding-commit that breaks it and demote that finding, kind=test-failure, with the failure attached.',
    TEST_NOTES ? 'Test commands: ' + TEST_NOTES : null,
    'Batch:',
    JSON.stringify(batch.map(f => ({ id: f.id, file: f.file, description: f.description, proposal: f.proposal, sketch: f.sketch, pairWith: f.pairWith || null, dependsOn: f.dependsOn || [], staleAfter: f.staleAfter || [] }))),
  ])
}

function ticketAgentPrompt(batch) {
  return j([
    'You are the auto-ticket agent of a ship wave — pure tracker mechanics, no code edits. Publish the validated findings below as tickets; their fixes are session-sized, so each ticket is work for a fresh agent session.',
    'Tracker operations:',
    TRACKER_MECHANICS,
    'Make each ticket a child of spec issue ' + SPEC_ISSUE_REF + ', labels: impl + ready-for-agent + review-finding — the next frontier computation picks these up, so review rework rides the next wave without anyone asking.',
    'Cluster by file: findings touching the same file(s) become ONE ticket while the combined work still fits a single fresh session; past that cap, split into independent tickets with NO blocking edges — file overlap is not a blocker.',
    'Each ticket body: the findings, why they matter (cited source), the validated proposals, anchors by file + short quoted snippet — never bare line numbers (they go stale).',
    'Batch:',
    JSON.stringify(batch.map(f => ({ id: f.id, file: f.file, description: f.description, citedSource: f.citedSource, proposal: f.proposal, sketch: f.sketch, demotedReason: f.demotedReason || '' }))),
    'Return every ticket you created with the finding IDs it covers.',
  ])
}

function ledgerPrompt(escalations, digest) {
  const marker = CLOSING ? '<!-- ship closing-' + WAVE + ' pending-questions -->' : '<!-- ship wave-' + WAVE + ' pending-questions -->'
  return j([
    'You are the ledger stage of a ship wave — the final stage, and a fresh assembler: you hold nothing but the structured findings below. Post ONE comment on spec issue ' + SPEC_ISSUE_REF + ' opening with the marker ' + marker + ' — durable run state a future session resumes from, so completeness beats brevity.',
    'Tracker operations:',
    TRACKER_MECHANICS,
    'The comment body, in order:',
    '1. The audit digest of the wave\'s auto-actions, stated as done: ' + JSON.stringify(digest),
    '2. One question block per escalation below, written for a COLD READER — someone who joined the project today and has not read the spec, the diff, or this run must be able to pick an option from the block alone. Speak the domain: behaviors, cases, consequences — not functions, paths, or line numbers. Name every cited decision or rule by what it decided or requires (from its title, gist, and quote), never by its ID alone; the finding ID appears once, trailing in parentheses in the header. Anything you cannot explain from the fields you hold, expand from the cited source text the finding carries. Format each:',
    '### <plain title of what is being decided> — <i> of <n> (<ID>)\n',
    '<One or two sentences: what part of the product this concerns and what the wave changed there, and what the question is.>\n',
    '> <the spec line, decision text, or code the question turns on — quoted verbatim from the finding\'s source field, with its anchor. An absence has no sentence to quote: say the material is silent and quote whatever was meant to cover it.>\n',
    '<What is wrong with that text, and what breaks downstream if it simply stands — the cost field the proposer filled, in the reader\'s terms.>\n',
    '- **<option, as an outcome for the product — what holds, what changes>** — <what it costs, what it triggers: fix now, ticket, spec comment>',
    '- **<option, as an outcome>** — <what it costs, what it triggers>\n',
    '<The option you would pick, and the one-line why.>',
    'The question class (spec unclear, competing fixes, genuine trade-off, no working fix, pervasive pattern) is routing vocabulary: it appears in the audit digest\'s counts, never inside a block. A spec-unclear block also carries a DRAFT spec comment per plausible reading — posted only on the user\'s verdict. A joined finding rides its target\'s block as one line of context, never its own block.',
    'The escalations:',
    JSON.stringify(escalations),
  ])
}

// ── Wave stages ──────────────────────────────────────────────────────────────

const parked = []       // { ref, at, reason }
const merged = []       // { ref, sha, testSummary }
let collisionNotes = []

if (!CLOSING) {
  phase('Claim + Plan')
  // Claims gate implementers, not planners — the claim agent and the planners run together.
  const claimAndPlans = await parallel([
    () => agent(claimPrompt(), { ...tier('executor'), schema: CLAIM_SCHEMA, effort: 'low', label: 'claim', phase: 'Claim + Plan' }),
  ].concat(TICKETS.map(t => () =>
    agent(plannerPrompt(t), { ...tier('decider'), schema: PLAN_SCHEMA, label: 'plan:' + t.ref, phase: 'Claim + Plan' }).then(p => ({ t, plan: p }))
  )))
  const claim = claimAndPlans[0] || { claimed: [], failed: TICKETS.map(t => ({ ref: t.ref, reason: 'claim agent died' })) }
  const plans = claimAndPlans.slice(1).filter(Boolean)

  for (const { t, plan } of plans) {
    if (!plan || plan.status === 'parked') parked.push({ ref: t.ref, at: 'plan', reason: plan ? plan.plan : 'planner died' })
  }
  for (const f of claim.failed) {
    if (!parked.some(p => p.ref === f.ref)) parked.push({ ref: f.ref, at: 'claim', reason: f.reason })
  }
  const active = plans.filter(({ t, plan }) => plan && plan.status === 'planned' && !parked.some(p => p.ref === t.ref))

  // Collision check — skipped for a one-ticket wave. Always an agent when 2+:
  // a seam is not a file, so a file-intersection prescreen only focuses the brief,
  // never replaces the check.
  const amendments = new Map()
  if (active.length > 1) {
    const overlaps = []
    for (let i = 0; i < active.length; i++) {
      for (let k = i + 1; k < active.length; k++) {
        const shared = (active[i].plan.files || []).filter(x => (active[k].plan.files || []).includes(x))
        if (shared.length) overlaps.push(active[i].t.ref + ' ∩ ' + active[k].t.ref + ': ' + shared.join(', '))
      }
    }
    const c = await agent(collisionPrompt(active, overlaps), { ...tier('decider'), schema: COLLISION_SCHEMA, label: 'collision-check', phase: 'Claim + Plan' })
    if (c) {
      for (const a of c.amendments) amendments.set(a.ref, a.amendment)
      collisionNotes = c.mergeNotes
    }
  }

  // Implement, then merge in completion order: each branch's merge chains onto a
  // shared promise — strictly serialized, but the first-finished branch merges and
  // tests while the slowest ticket is still implementing. In-wave tickets are
  // dependency-free by construction, so completion order is safe.
  let mergeLock = Promise.resolve()
  await parallel(active.map(({ t, plan }) => async () => {
    const impl = await agent(implementerPrompt(t, plan, amendments.get(t.ref)),
      { ...tier('executor'), schema: IMPL_SCHEMA, isolation: 'worktree', label: 'impl:' + t.ref, phase: 'Implement' })
    if (!impl || impl.status === 'parked' || !impl.branch) {
      parked.push({ ref: t.ref, at: 'implement', reason: impl ? impl.notes : 'implementer died' })
      return
    }
    const myTurn = mergeLock.then(() =>
      agent(mergePrompt(t, impl.branch, collisionNotes), { ...tier('executor'), schema: MERGE_SCHEMA, label: 'merge:' + t.ref, phase: 'Merge' }))
    mergeLock = myTurn.catch(() => null) // a failed merge never blocks the chain
    const m = await myTurn
    if (m && m.status === 'merged') merged.push({ ref: t.ref, sha: m.sha, testSummary: m.testSummary })
    else parked.push({ ref: t.ref, at: 'merge', reason: m ? m.testSummary : 'merge agent died' })
  }))
  log('Wave ' + WAVE + ': ' + merged.length + ' tickets merged, ' + parked.length + ' parked')
}

// ── Verification pipeline over the merged diff ───────────────────────────────

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// One axis: chunks of findings flow through validate → propose → validate-fix as
// independent pipeline chains — no cross-chunk barriers. One agent per chunk per
// stage: validators stay fresh and adversarial, the proposer keeps cross-finding
// coherence within its chunk.
async function runAxis(axisName, labeled) {
  const shelved = labeled.filter(f => f.dedup === 'already-ticketed' || f.dedup === 'already-adjudicated')
  const inQueue = labeled.filter(f => f.dedup !== 'already-ticketed' && f.dedup !== 'already-adjudicated')
  const roster = inQueue.map(f => f.id + ' — ' + f.file + ': ' + f.description).join('\n')

  await pipeline(chunk(inQueue, CHUNK_SIZE),
    async (c, _, i) => {
      const r = await agent(findingValidatorPrompt(axisName, c),
        { ...tier('decider'), schema: FINDING_VERDICTS_SCHEMA, phase: 'Validate findings', label: 'validate:' + axisName + ':' + (i + 1) })
      const verdicts = new Map(((r && r.verdicts) || []).map(v => [v.id, v]))
      for (const f of c) {
        const v = verdicts.get(f.id)
        // A validator that died keeps its finding — but the keeping is only half the
        // conservatism: unvalidated is carried as a flag so routing can refuse to
        // auto-apply it. Failing toward MORE action is the thing to avoid here.
        f.unvalidated = !v
        f.findingVerdict = v ? v.verdict : 'finding-validated'
        f.findingReason = v ? v.reason : 'validator result missing — kept unvalidated'
        f.specClassification = v ? v.specClassification : 'n/a'
        // Scope is settled before merits, by the script and not the prompt: a finding
        // anchored to code the diff never touched leaves here, however real it is.
        f.scope = v && v.scope ? v.scope : 'introduced-by-diff'
        if (f.scope === 'pre-existing') {
          f.findingVerdict = 'finding-refuted'
          f.findingReason = 'out of scope — anchored to code this diff never touched' + (v && v.reason ? ': ' + v.reason : '')
        }
        if (v && v.repoWideRaised) { f.repoWide = true; f.repoWideEvidence = v.repoWideEvidence }
      }
      return c.filter(f => f.findingVerdict === 'finding-validated')
    },
    async (survivors, _, i) => {
      if (!survivors.length) return survivors
      const props = await agent(proposerPrompt(axisName, survivors),
        { ...tier('decider'), schema: PROPOSALS_SCHEMA, phase: 'Propose', label: 'propose:' + axisName + ':' + (i + 1) })
      const byId = new Map(((props && props.proposals) || []).map(p => [p.id, p]))
      for (const f of survivors) {
        const p = byId.get(f.id)
        f.proposal = p ? p.fix : 'proposal missing'
        f.sketch = p ? p.sketch : ''
        f.size = p ? p.size : 'needs-a-session'
        f.docOnly = p ? !!p.docOnly : false
      }
      return survivors
    },
    async (survivors, _, i) => {
      if (!survivors.length) return survivors
      const r = await agent(fixValidatorPrompt(axisName, survivors, roster),
        { ...tier('decider'), schema: FIX_VERDICTS_SCHEMA, phase: 'Validate fixes', label: 'validate-fix:' + axisName + ':' + (i + 1) })
      const fvs = new Map(((r && r.verdicts) || []).map(v => [v.id, v]))
      for (const f of survivors) {
        const v = fvs.get(f.id)
        f.fixVerdict = v ? v.verdict : 'needs-human'
        f.fixReason = v ? v.reason : 'fix-validator result missing'
        // This stage has the last word on repo-wide and docOnly — the routing step reads both from here.
        if (v) {
          f.docOnly = !!v.docOnly
          f.repoWide = v.repoWide && v.instancesOutsideDiff > 0
          f.instancesInDiff = v.instancesInDiff
          f.instancesOutsideDiff = v.instancesOutsideDiff
        }
        f.dependsOn = v ? v.dependsOn : []
        f.invalidatedBy = v ? v.invalidatedBy : []
      }
      return survivors
    })

  const survivors = inQueue.filter(f => f.findingVerdict === 'finding-validated')
  const refuted = inQueue.filter(f => f.findingVerdict === 'finding-refuted')
  log(axisName + ': ' + labeled.length + ' findings — ' + survivors.length + ' validated, ' + refuted.length + ' refuted, ' + shelved.length + ' shelved by dedup')
  return { survivors, refuted, shelved }
}

async function standardsAxis(groups) {
  if (!STANDARDS_SOURCES.length && !CLOSING) {
    log('No documented standards — standards axis idle')
    return { idle: true, survivors: [], refuted: [], shelved: [] }
  }
  const thunks = []
  if (CLOSING) {
    // The closing pass's standards-side source is the cross-wave sweeper — the one
    // place the pipeline looks beyond written rules, at parallel-implementation drift.
    thunks.push(() => agent(sweeperPrompt('closing'), { ...tier('auditor'), phase: 'Review', label: 'review:cross-wave-sweeper' }))
    if (STANDARDS_SOURCES.length) thunks.push(...groups.map(g => () => agent(standardsReviewerPrompt(g), { ...tier('decider'), phase: 'Review', label: 'review:std:' + g.name })))
  } else {
    thunks.push(...groups.map(g => () => agent(standardsReviewerPrompt(g), { ...tier('decider'), phase: 'Review', label: 'review:std:' + g.name })))
    if (groups.length > 1) thunks.push(() => agent(sweeperPrompt('wave'), { ...tier('decider'), phase: 'Review', label: 'review:std:cross-cutting' }))
  }
  const reports = (await parallel(thunks)).filter(Boolean)
  const labeled = await agent(labelPrompt('STD', 'Standards', reports), { ...tier('auditor'), schema: FINDINGS_SCHEMA, phase: 'Label', label: 'label:std' })
  return runAxis('Standards', labeled ? labeled.findings : [])
}

async function specAxis(groups, requirements) {
  const reports = []
  if (CLOSING) {
    // Requirements-union: is every requirement implemented SOMEWHERE in the run?
    const suspects = (await agent(requirementsUnionPrompt(), { ...tier('auditor'), phase: 'Review', label: 'review:requirements-union' }) || '')
      .split('\n').map(s => s.trim()).filter(Boolean)
    if (suspects.length) {
      const checks = (await parallel(suspects.map(q => () =>
        agent(checkerPrompt(q), { ...tier('decider'), schema: CHECKER_SCHEMA, phase: 'Review', label: 'check:coverage' }).then(c => ({ q, c }))))).filter(Boolean)
      const missing = checks.filter(x => x.c.status === 'missing' || x.c.status === 'partial')
      if (missing.length) reports.push('Requirements-union check:\n' + missing.map(x => '- ' + x.q + ': ' + x.c.status + ' — ' + x.c.note).join('\n'))
    }
  } else {
    const reviews = (await parallel(groups.map(g => () =>
      agent(specReviewerPrompt(g), { ...tier('decider'), schema: SPEC_REVIEW_SCHEMA, phase: 'Review', label: 'review:spec:' + g.name })))).filter(Boolean)
    reports.push(...reviews.map(r => r.report))
    if (groups.length > 1 && requirements.length) {
      const touched = new Set(reviews.flatMap(r => r.requirementsTouched))
      const unclaimed = requirements.filter(q => !touched.has(q))
      if (unclaimed.length) {
        const checks = (await parallel(unclaimed.map(q => () =>
          agent(checkerPrompt(q), { ...tier('decider'), schema: CHECKER_SCHEMA, phase: 'Review', label: 'check:coverage' }).then(c => ({ q, c }))))).filter(Boolean)
        const missing = checks.filter(x => x.c.status === 'missing' || x.c.status === 'partial')
        if (missing.length) reports.push('Requirement-coverage check (requirements no slice claimed):\n' + missing.map(x => '- ' + x.q + ': ' + x.c.status + ' — ' + x.c.note).join('\n'))
      }
    }
  }
  if (!reports.length) return { survivors: [], refuted: [], shelved: [] }
  const labeled = await agent(labelPrompt('SPEC', 'Spec', reports), { ...tier('auditor'), schema: FINDINGS_SCHEMA, phase: 'Label', label: 'label:spec' })
  return runAxis('Spec', labeled ? labeled.findings : [])
}

let groups = [{ name: 'whole-diff', paths: null, decisionIds: null, diffCmd: DIFF_CMD }]
let requirements = []
if (WIDE && !CLOSING) {
  phase('Review')
  const fileList = 'Changed files: run ' + DIFF_CMD + ' --stat yourself for the list and sizes.'
  const p = await agent(partitionPrompt(fileList), { ...tier('decider'), schema: PARTITION_SCHEMA, label: 'partition', phase: 'Review' })
  if (p && p.groups.length) {
    groups = p.groups.map(g => ({ name: g.name, paths: g.paths, decisionIds: g.decisionIds, diffCmd: DIFF_CMD + ' -- ' + g.paths.join(' ') }))
    requirements = p.requirements
    log('Partitioned into ' + groups.length + ' groups: ' + groups.map(g => g.name).join(', '))
  }
}

const axes = await parallel([() => standardsAxis(groups), () => specAxis(groups, requirements)])
const std = axes[0] || { survivors: [], refuted: [], shelved: [] }
const spec = axes[1] || { survivors: [], refuted: [], shelved: [] }

// Cross-axis pairs: same file, overlapping lines — one defect wearing two labels.
const pairList = []
for (const s of std.survivors) {
  for (const p of spec.survivors) {
    if (s.file === p.file && s.lineStart <= p.lineEnd && p.lineStart <= s.lineEnd) {
      s.crossAxisPair = p.id
      p.crossAxisPair = s.id
      pairList.push([s, p])
    }
  }
}
if (pairList.length) {
  const settled = await parallel(pairList.map(([a, b]) => () =>
    agent(pairPrompt(a, b), { ...tier('decider'), schema: PAIR_SCHEMA, phase: 'Validate fixes', label: 'pair:' + a.id + '+' + b.id })))
  pairList.forEach(([a, b], i) => {
    const r = settled[i]
    // A dead pair agent escalates the pair — conservative, and visible.
    a.pairResolution = b.pairResolution = r ? r.resolution : 'competing'
    a.pairReason = b.pairReason = r ? r.reason : 'pair-resolution agent died'
  })
}

// ── Route every survivor — plain script logic, no agent decides this ─────────

const all = std.survivors.concat(spec.survivors)
const byId = new Map(all.map(f => [f.id, f]))

for (const f of all) {
  // A validated doc-only quick-fix on a spec-suspect finding auto-applies: the code's
  // behaviour was deemed right, only the record was wrong — no intent question remains.
  const docOnlyResolved = f.fixVerdict === 'validated' && f.size === 'quick-fix' && f.docOnly
  if (f.specClassification === 'spec-suspect' && !docOnlyResolved) { f.route = 'escalate'; f.questionClass = 'spec-unclear' }
  else if (f.crossAxisPair && f.pairResolution === 'competing') { f.route = 'escalate'; f.questionClass = 'competing-fixes' }
  else if (f.repoWide) { f.route = 'escalate'; f.questionClass = 'pervasive-pattern' }
  else if (f.fixVerdict === 'needs-human') { f.route = 'escalate'; f.questionClass = 'genuine-trade-off' }
  else if (f.fixVerdict === 'fix-rejected') { f.route = 'escalate'; f.questionClass = 'no-working-fix' }
  else if (f.size === 'quick-fix') { f.route = 'auto-apply' }
  else { f.route = 'auto-ticket' }
}

// A stage agent that dies must fail toward LESS action, never more — the pair agent
// escalates and the fix validator returns needs-human on death. A finding whose own
// validator never returned is kept, but it is never committed unasked.
for (const f of all) {
  if (f.unvalidated && f.route === 'auto-apply') {
    f.route = 'auto-ticket'
    f.demotedReason = 'finding never validated — its validator agent returned nothing'
  }
}

// Edges and pairs route together — escalation dominates, then ticket, then apply.
const RANK = { 'auto-apply': 0, 'auto-ticket': 1, 'escalate': 2 }
let routesSettled = false
while (!routesSettled) {
  routesSettled = true
  for (const f of all) {
    const partners = (f.dependsOn || []).concat(f.crossAxisPair ? [f.crossAxisPair] : [])
    for (const id of partners) {
      const t = byId.get(id)
      if (t && RANK[t.route] > RANK[f.route]) {
        f.route = t.route
        if (t.route === 'escalate') { f.questionClass = 'joined'; f.joinedTo = t.id }
        if (t.route === 'auto-ticket') f.ticketWith = t.id
        routesSettled = false
      }
    }
    for (const id of (f.invalidatedBy || [])) {
      const t = byId.get(id)
      if (!t) continue
      if (t.route === 'escalate' && f.route !== 'escalate') { f.route = 'escalate'; f.questionClass = 'joined'; f.joinedTo = t.id; routesSettled = false }
      if (t.route === 'auto-apply') f.staleAfter = (f.staleAfter || []).concat(t.id)
    }
  }
}

for (const [a, b] of pairList) {
  if (a.pairResolution === 'agreeing' && a.route === 'auto-apply' && b.route === 'auto-apply') {
    a.pairWith = b.id
    b.pairWith = a.id
  }
}

phase('Resolve')

// Order the auto-apply batch by dependsOn edges — dependencies first; edges never block.
const autoApply = all.filter(f => f.route === 'auto-apply')
const applyIds = new Set(autoApply.map(f => f.id))
const ordered = []
const pending = autoApply.slice()
while (pending.length) {
  let i = pending.findIndex(f => (f.dependsOn || []).every(d => !applyIds.has(d) || ordered.some(o => o.id === d)))
  if (i < 0) i = 0 // dependency cycle — apply in given order; edges order the batch, never block it
  ordered.push(pending.splice(i, 1)[0])
}

let apply = { applied: [], demoted: [], testSummary: 'no auto-apply candidates' }
if (ordered.length) {
  apply = (await agent(fixAgentPrompt(ordered), { ...tier('executor'), schema: APPLY_SCHEMA, label: 'fix:auto-apply' })) ||
    { applied: [], demoted: ordered.map(f => ({ id: f.id, reason: 'demoted: fix agent died', kind: 'preconditions' })), testSummary: '' }
}
for (const a of apply.applied) { const f = byId.get(a.id); if (f) { f.status = 'auto-applied'; f.sha = a.sha } }
for (const d of apply.demoted) {
  const f = byId.get(d.id)
  if (!f) continue
  f.demotedReason = d.reason
  if (d.kind === 'preconditions') { f.route = 'auto-ticket' }
  else { f.route = 'escalate'; f.questionClass = 'no-working-fix'; f.fixReason = d.reason }
}

// Auto-ticket — after the fix agent, so precondition demotions land in its batch.
const autoTicket = all.filter(f => f.route === 'auto-ticket')
let tickets = []
if (autoTicket.length) {
  const t = await agent(ticketAgentPrompt(autoTicket), { ...tier('executor'), schema: TICKET_SCHEMA, label: 'ticket:auto', effort: 'low' })
  tickets = (t && t.tickets) || []
  const covered = new Set(tickets.flatMap(x => x.findingIds))
  for (const f of autoTicket) {
    if (covered.has(f.id)) {
      f.status = 'auto-ticketed'
      f.ticketRef = (tickets.find(x => x.findingIds.includes(f.id)) || {}).ref
    } else {
      f.status = 'ticket-pending-manager' // not published — hand it back rather than lose it
    }
  }
}

const escalations = all.filter(f => f.route === 'escalate').map(f => ({
  id: f.id, kind: f.kind, axis: f.id.includes('-STD-') ? 'standards' : 'spec',
  file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd,
  description: f.description, citedSource: f.citedSource,
  questionClass: f.questionClass, joinedTo: f.joinedTo || null,
  crossAxisPair: f.crossAxisPair || null, pairResolution: f.pairResolution || null, pairReason: f.pairReason || null,
  specClassification: f.specClassification, proposal: f.proposal, sketch: f.sketch, size: f.size,
  fixVerdict: f.fixVerdict, fixReason: f.fixReason,
  repoWide: !!f.repoWide, repoWideEvidence: f.repoWideEvidence || '',
  instancesInDiff: f.instancesInDiff || 0, instancesOutsideDiff: f.instancesOutsideDiff || 0,
  demotedReason: f.demotedReason || null,
}))

// The closing pass's deferred queue joins as-is — already validated, already proposed.
const deferredQueue = CLOSING ? (CLOSING.deferredQueue || []) : []

// Ledger post — by the workflow, not the manager: the queue must be durable even
// if the session dies the moment the workflow returns.
const digest = {
  merged: merged, parked: parked,
  refuted: std.refuted.concat(spec.refuted).map(f => ({ id: f.id, reason: f.findingReason })),
  autoApplied: apply.applied, autoTicketed: tickets,
}
let ledger = { posted: false, marker: 'no escalations — no pending-questions comment needed' }
if (escalations.length || deferredQueue.length) {
  ledger = (await agent(ledgerPrompt(escalations.concat(deferredQueue), digest), { ...tier('decider'), schema: LEDGER_SCHEMA, label: 'ledger:pending-questions', phase: 'Resolve' })) ||
    { posted: false, marker: 'ledger agent died — POST THE PENDING-QUESTIONS COMMENT FROM THE MANAGER before anything else' }
}

log('Routing: ' + apply.applied.length + ' auto-applied, ' +
  all.filter(f => f.status === 'auto-ticketed').length + ' auto-ticketed (' + tickets.length + ' tickets), ' +
  escalations.length + ' escalated' + (deferredQueue.length ? ' (+' + deferredQueue.length + ' deferred raised)' : '') +
  (all.some(f => f.status === 'ticket-pending-manager') ? ', ' + all.filter(f => f.status === 'ticket-pending-manager').length + ' tickets pending the manager' : ''))

// The full routed queue — all the manager ever sees of this workflow.
return {
  wave: WAVE, closing: !!CLOSING,
  merged: merged, parked: parked,
  standards: { idle: !!std.idle, queue: std.survivors, refuted: std.refuted, shelved: std.shelved },
  spec: { queue: spec.survivors, refuted: spec.refuted, shelved: spec.shelved },
  autoApplied: apply.applied,
  autoTicketed: tickets,
  ticketPendingManager: all.filter(f => f.status === 'ticket-pending-manager').map(f => f.id),
  escalations: escalations,
  deferredRaised: deferredQueue,
  ledger: ledger,
  testSummary: apply.testSummary,
  partitioned: groups.length > 1 ? groups.map(g => g.name) : null,
}
