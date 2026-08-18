export const meta = {
  name: 'tareview',
  description: 'Find→validate→propose→validate→route pipeline over the diff since a fixed point, along Standards and Spec axes — escalate intent, auto-resolve code',
  phases: [
    { title: 'Partition', detail: 'cluster a wide diff into shared subsystem groups' },
    { title: 'Review', detail: 'one reviewer per axis — per group and axis when partitioned — plus the cross-cutting sweeper' },
    { title: 'Label', detail: 'normalize reports into IDed findings; dedup vs open tickets and prior rounds' },
    { title: 'Validate findings', detail: 'fresh adversarial validators — refuted findings leave the pipeline here' },
    { title: 'Propose', detail: 'one proposer per chunk over its surviving findings' },
    { title: 'Validate fixes', detail: 'fresh adversarial validators, one question per check; pair resolution' },
    { title: 'Resolve', detail: 'script routing — escalate intent, auto-resolve code: serial fix agent applies, ticket agent publishes' },
  ],
}

// Template for the /tareview pipeline workflow — SKILL.md steps 4–9 hold the stage
// briefs this file encodes; keep the two in sync when either changes.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch — loud,
// before any agent spawns. Fill prose slots as JSON string literals (double
// quotes, \n escapes): mechanical to produce, and immune to the backticks and
// apostrophes that terminate template literals and single-quoted strings.
// Nothing goes through `args` — ever.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const DIFF_CMD = FILL             // "git diff <fixed-point>...HEAD" — three-dot, from step 1
const COMMIT_LOG = FILL           // full `git log <fixed-point>..HEAD` output — full messages, validators read them
const DIFF_STAT = FILL            // `git diff <fixed-point>...HEAD --stat` output — the partition agent reads this, not the diff
const WIDE = FILL                 // true past ~15 files / ~1,500 changed lines (judge from DIFF_STAT) → partition stage runs
const SPEC = FILL                 // full spec contents reassembled per the tracker doc (kernel + decisions in index order), or null → Spec axis skips
const SPEC_SOURCE = FILL          // where the spec came from, one line ("issue #42", "docs/prd.md") — "" when SPEC is null
const SPEC_KERNEL = FILL          // WIDE + Decision Index only: kernel body incl. the index; else null → reviewers get full SPEC
const SPEC_DECISIONS = FILL       // WIDE + Decision Index only: { "D-3": "full decision text", ... }; else null
const TRACKER_READ_OP = FILL      // one-liner: how an agent fetches a spec decision by ID (the tracker doc's read), or ""
const STANDARDS_SOURCES = FILL    // [{ path: "CONVENTIONS.md", scope: "repo root" }, ...] — reviewers read the files themselves; [] when nothing documented
const OPEN_REVIEW_TICKETS = FILL  // pre-fetched open `review-finding` tickets: [{ ref: "#12", title: "...", body: "..." }] — [] if none
const PRIOR_ROUND_SUMMARIES = FILL// pre-fetched prior-round summary comments from the spec issue: ["..."] — [] if none
const DEFAULT_BRANCH_OK = FILL    // false, or the user's exact words OKing commits on the default branch — travels only in the fix agent's brief
const SPEC_ISSUE_REF = FILL       // tracker ref of the spec issue ("#42") when the spec IS a tracker issue, else null — auto-tickets parent to it
const TICKET_MECHANICS = FILL     // prose: the tracker's create/label/parent operations per /issue-tracker (exact commands), or null → auto-ticket findings come back for the manager to file in step 12

// ═══════════ FIXED BELOW THIS LINE — edit only when the run genuinely deviates ═══════════

const CHUNK_SIZE = 5 // findings per chunk — an axis's findings flow through validate → propose → validate-fix in chunks, each chunk an independent pipeline chain

const SMELL_BASELINE = [
  'Smell baseline (Fowler, Refactoring ch.3) — applies even when the repo documents nothing. Every hit is a labelled hypothesis ("possible Feature Envy") the adversarial validators must confirm; a documented repo standard overrides the baseline; skip anything tooling already enforces. Each smell reads what-it-is → how-to-fix:',
  '- Mysterious Name — a function, variable, or type whose name does not reveal what it does or holds. → rename it; if no honest name comes, the design is murky.',
  '- Duplicated Code — the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.',
  '- Feature Envy — a method that reaches into another object\'s data more than its own. → move the method onto the data it envies.',
  '- Data Clumps — the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.',
  '- Primitive Obsession — a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.',
  '- Repeated Switches — the same switch/if-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.',
  '- Shotgun Surgery — one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.',
  '- Divergent Change — one file or module is edited for several unrelated reasons. → split so each module changes for one reason.',
  '- Speculative Generality — abstraction, parameters, or hooks added for needs the spec does not have. → delete it; inline back until a real need shows.',
  '- Message Chains — long a.b().c().d() navigation the caller should not depend on. → hide the walk behind one method on the first object.',
  '- Middle Man — a class or function that mostly just delegates onward. → cut it, call the real target direct.',
  '- Refused Bequest — a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.',
].join('\n')

const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')

const COMMON = j([
  'Diff command (run it yourself): ' + DIFF_CMD,
  'Commits under review (full messages):',
  COMMIT_LOG,
])

// Both axes' inputs — every validator gets all of this regardless of its axis.
const AXIS_INPUTS = j([
  STANDARDS_SOURCES.length
    ? 'Standards sources (read the files yourself; a scoped CONVENTIONS.md governs only files under its directory, nearest scope winning):\n' +
      STANDARDS_SOURCES.map(s => '- ' + s.path + ' — binds ' + s.scope).join('\n')
    : 'This repo documents no coding standards — the smell baseline is the only Standards source this round.',
  SMELL_BASELINE,
  SPEC ? 'Spec (' + SPEC_SOURCE + '):\n' + SPEC : 'No spec available.',
])

// ── Schemas ──────────────────────────────────────────────────────────────────

const FINDING_FIELDS = {
  id: { type: 'string' },
  file: { type: 'string' },
  lineStart: { type: 'integer' },
  lineEnd: { type: 'integer' },
  description: { type: 'string', description: 'one line' },
  repoWide: { type: 'boolean' },
  repoWideEvidence: { type: 'string', description: 'the grep plus both counts, or ""' },
  citedSource: { type: 'string', description: 'the standard rule (file + rule) or named smell, or the spec line — with its decision ID where it has one' },
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
}
const PROPOSALS_SCHEMA = {
  type: 'object', required: ['proposals'],
  properties: { proposals: { type: 'array', items: { type: 'object', required: Object.keys(PROPOSAL_FIELDS), properties: PROPOSAL_FIELDS } } },
}

const FIX_VERDICT_FIELDS = {
  id: { type: 'string' },
  verdict: { enum: ['validated', 'fix-rejected', 'needs-human'] },
  reason: { type: 'string' },
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
    requirements: { type: 'array', items: { type: 'string' }, description: 'the spec\'s discrete requirements as short strings; [] when no spec' },
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
          ref: { type: 'string', description: 'the created ticket\'s ref, e.g. #57' },
          title: { type: 'string' },
          findingIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function partitionPrompt() {
  return j([
    'You are the partition stage of a wide-diff two-axis review. Read the file list and stats below — not the full diff.',
    'Diff stat:',
    DIFF_STAT,
    STANDARDS_SOURCES.length
      ? 'Standards-scope map (scoped CONVENTIONS.md boundaries — align groups with these where possible):\n' +
        STANDARDS_SOURCES.map(s => '- ' + s.path + ' — binds ' + s.scope).join('\n')
      : null,
    SPEC ? 'Spec (' + SPEC_SOURCE + '):\n' + SPEC : 'No spec available.',
    'Cluster the changed files into logical groups by subsystem or directory. Every changed file lands in exactly one group. Route spec decision IDs to the group whose files answer them, the same way you cluster files (decisionIds per group; [] when the spec has no Decision Index).',
    'Also enumerate the spec\'s discrete requirements as short strings in `requirements` — the requirement-coverage union check needs them. [] when there is no spec.',
  ])
}

function standardsReviewerPrompt(g) {
  return j([
    'You are the Standards reviewer of a two-axis review: does the code conform to this repo\'s documented coding standards?',
    COMMON,
    g.paths ? 'Your slice: ' + g.name + '. Path-scoped diff command: ' + g.diffCmd : null,
    STANDARDS_SOURCES.length
      ? 'Standards sources (read the files yourself; a scoped CONVENTIONS.md governs only files under its directory, nearest scope winning):\n' +
        STANDARDS_SOURCES.map(s => '- ' + s.path + ' — binds ' + s.scope).join('\n')
      : 'This repo documents no coding standards — the smell baseline below is the only Standards source this round.',
    SMELL_BASELINE,
    'Report — per file/hunk where relevant — (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk — a smell is a labelled hypothesis for the validators, and a documented repo standard overrides the baseline. (c) When a finding looks like an instance of a pattern rather than a one-off, and the pattern has a statable grep signature (a banned element or API, a naming rule), grep for it outside the diff and flag the finding repo-wide only with the grep and both counts attached — instances inside the diff, instances outside it. A pattern with zero instances outside the diff is this change\'s own duplication, not a repo pattern. Skip anything tooling enforces. Under 400 words.',
    'Your final text IS the report.',
  ])
}

function sweeperPrompt() {
  return j([
    'You are the cross-cutting sweeper on the Standards axis of a partitioned review. Chunk reviewers each see one group; four smells span groups by nature, and only you can see them: Duplicated Code, Repeated Switches, Shotgun Surgery, Divergent Change.',
    COMMON,
    'Read the whole diff at low resolution — file list and hunk headers, reading closer only where something looks suspicious. Hunt ONLY those four smells. Report each hit: name the smell, quote the hunks involved. Every hit is a hypothesis for the validators. Under 300 words.',
    'Your final text IS the report.',
  ])
}

function specSliceContext(g) {
  if (!WIDE || !SPEC_KERNEL) return 'Spec (' + SPEC_SOURCE + '):\n' + SPEC
  const routed = (g.decisionIds || []).filter(d => SPEC_DECISIONS && d in SPEC_DECISIONS)
  return j([
    'Spec kernel (' + SPEC_SOURCE + ') — its Decision Index one-liners stand in for every decision not given in full below, so scope creep stays checkable against the whole decision surface:',
    SPEC_KERNEL,
    routed.length
      ? 'Full text of the decisions routed to your group:\n' + routed.map(d => '### ' + d + '\n' + SPEC_DECISIONS[d]).join('\n\n')
      : 'No decisions were routed to your group.',
    TRACKER_READ_OP ? 'If a hunk looks like it answers an UNROUTED decision, fetch that decision by ID: ' + TRACKER_READ_OP : null,
  ])
}

function specReviewerPrompt(g) {
  return j([
    'You are the Spec reviewer of a two-axis review: does the code faithfully implement the originating spec?',
    COMMON,
    g.paths ? 'Your slice: ' + g.name + '. Path-scoped diff command: ' + g.diffCmd : null,
    specSliceContext(g),
    'Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that was not asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Treat the spec\'s decision snippets (state machines, schemas, type shapes, contracts — inline or in its addressable decisions) as requirements — divergence from one is a finding like any other. Quote the spec line, with its decision ID where it has one, for each finding. Under 400 words.',
    'Also fill requirementsTouched: the spec requirements your slice\'s files touch (whether or not you found problems with them).',
  ])
}

function checkerPrompt(q) {
  return j([
    'One spec requirement was claimed by no reviewer slice in a partitioned review. Requirement: ' + q,
    COMMON,
    'Check whether it is implemented. Absent from the changed files does NOT mean unimplemented — it may pre-exist; search the repo before you call it missing.',
  ])
}

function labelPrompt(prefix, axisName, reports) {
  return j([
    'You are the labeling stage of a two-axis review — normalize raw reviewer reports into a list of discrete findings (light cleaning, no re-reviewing).',
    'Axis: ' + axisName + '. Assign IDs ' + prefix + '-1, ' + prefix + '-2, ... in report order.',
    'Reviewer reports:',
    reports.map((r, i) => '--- report ' + (i + 1) + ' ---\n' + r).join('\n'),
    WIDE ? 'Reports overlap (chunk reviewers plus a cross-cutting sweeper) — dedup across report boundaries: one finding per underlying defect.' : null,
    'Each finding carries: file + lineStart/lineEnd anchoring it, a one-line description, the repo-wide flag where a reviewer raised it (carry its grep evidence), and the cited source (the documented rule or named smell, or the spec line).',
    'Dedup against the open review-finding tickets below. Match conservatively — a standalone cleanup ticket matches at the rule/pattern level; a spec-child ticket matches only same file + same rule:',
    JSON.stringify(OPEN_REVIEW_TICKETS),
    '- Subject predates this diff (visible in context, not introduced by the change) and matches an open ticket → dedup=already-ticketed, dedupRef=#N.',
    '- Introduced by this diff but matches a ticketed pattern → dedup=instance-of-open, dedupRef=#N (it stays in the pipeline — new instances of a known pattern are new debt).',
    '- Uncertain match → dedup=possibly-duplicates, dedupRef=#N (stays in the pipeline). A visible duplicate is recoverable; a silent suppression is not.',
    'Dedup against prior review rounds — every finding adjudicated in one of these summary comments (auto-applied, auto-ticketed, answered by a verdict, refuted by a validator, reverted, or left as-is) is already decided → dedup=already-adjudicated, dedupRef=the prior outcome:',
    JSON.stringify(PRIOR_ROUND_SUMMARIES),
  ])
}

function findingValidatorPrompt(axisName, findings) {
  return j([
    'You are a fresh adversarial validator in a two-axis review. You did not author these findings; your job is to try to REFUTE each one, on its own — no fix exists yet.',
    COMMON,
    AXIS_INPUTS,
    'Findings to validate (axis: ' + axisName + '):',
    JSON.stringify(findings.map(f => ({ id: f.id, file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd, description: f.description, repoWide: f.repoWide, citedSource: f.citedSource }))),
    'Per finding, answer one question: is the finding real? Read the cited source and the actual hunk — does the standard rule or spec line say what the reviewer claims, does the code actually breach it, and does the claimed harm survive what the compiler and tooling already guarantee? verdict=finding-refuted (with the reason) or finding-validated.',
    axisName === 'Spec'
      ? 'Also classify each finding: code-diverges — the spec is unambiguous, the code does not match, the fix is mechanical — or spec-suspect — the divergence exposes an assumption baked into the spec that the code may contradict deliberately; the SPEC may be wrong. Before choosing, read the commit messages and any tests touching the diverging code: evidence of a deliberate deviation → spec-suspect. Any doubt → spec-suspect — a false spec-suspect costs one human glance; a false code-diverges silently rewrites behaviour.'
      : 'specClassification is n/a on this axis.',
    axisName === 'Standards'
      ? 'You may set repoWideRaised on a finding whose pattern the reviewer missed — only with the grep and both counts (inside and outside the diff) in repoWideEvidence.'
      : null,
  ])
}

function proposerPrompt(axisName, survivors) {
  return j([
    'You are the ' + axisName + ' fix proposer of a two-axis review. Every finding below survived adversarial validation; the finding\'s reality is settled.',
    COMMON,
    AXIS_INPUTS,
    'Validated findings, each with its validator\'s reasoning:',
    JSON.stringify(survivors.map(f => ({ id: f.id, file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd, description: f.description, citedSource: f.citedSource, specClassification: f.specClassification, validatorReasoning: f.findingReason }))),
    'For each finding, propose the smallest concrete fix that resolves it: what to change, where — anchor by file plus a short quoted snippet of the code being changed, not a bare line number (lines drift once fixes start landing) — and a short sketch of the changed code — a sketch, not a full patch. Size each fix: quick-fix (a few edits — a candidate for the serial fix agent) or needs-a-session (a fresh context window\'s worth of work). Keep each proposal under 100 words.',
    axisName === 'Standards' ? 'For baseline smells, the smell\'s generic how-to-fix is the starting point — your job is grounding it in the actual hunk.' : null,
    axisName === 'Spec' ? 'A spec-suspect finding gets a fix sketch per plausible reading where that is cheap — the user\'s answer will pick one.' : null,
  ])
}

function fixValidatorPrompt(axisName, items, roster) {
  return j([
    'You are a fresh adversarial fix validator in a two-axis review — not the proposer, and not the finding validator. Your job is to try to REFUTE each fix.',
    COMMON,
    AXIS_INPUTS,
    'Proposals to validate (axis: ' + axisName + '; each with its finding and the finding-validator\'s reasoning):',
    JSON.stringify(items.map(f => ({ id: f.id, file: f.file, description: f.description, citedSource: f.citedSource, findingReasoning: f.findingReason, proposal: f.proposal, sketch: f.sketch, size: f.size, repoWide: f.repoWide, repoWideEvidence: f.repoWideEvidence }))),
    'Every finding in this axis, for the edge fields below — dependsOn / invalidatedBy may name IDs outside your batch:',
    roster,
    'Per proposal, check: (1) does the fix actually resolve the finding? (2) is it proportionate — the minimal change that clears the finding, no speculative rewrites? (3) cross-axis: a fix for a Spec finding must not introduce a Standards violation, and a Standards fix must not change behaviour the spec asked for. (4) re-settle the repo-wide flag: run the grep yourself and fill instancesInDiff / instancesOutsideDiff — the flag holds only when instancesOutsideDiff > 0; a pattern whose every instance sits inside the diff is this change\'s own duplication, fixable here. Your call on the flag is final downstream.',
    'Verdict per proposal: validated, fix-rejected (with the reason), or needs-human (a genuine trade-off the user must call). The finding\'s reality is NOT on the table — that was settled upstream; record any lingering doubt about the premise inside a fix-rejected reason.',
    'Fill the edge fields instead of burying edges in prose: dependsOn = IDs whose fixes must land for this one to work (say, it reads a const another fix introduces); invalidatedBy = IDs whose accepted fix makes this proposal\'s premise or wording false.',
  ])
}

function pairPrompt(a, b) {
  return j([
    'Two findings from different axes of a review anchor to the same code — usually one defect wearing two labels — and each carries a fix proposal that survived adversarial validation. Decide whether the two fixes AGREE (compatible or identical in effect — both can land, or one subsumes the other) or COMPETE (they cannot both land; they pull the code different ways).',
    COMMON,
    AXIS_INPUTS,
    'The pair:',
    JSON.stringify([a, b].map(f => ({ id: f.id, file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd, description: f.description, citedSource: f.citedSource, proposal: f.proposal, sketch: f.sketch }))),
  ])
}

function fixAgentPrompt(batch) {
  return j([
    'You are the serial fix agent of a review pipeline — working alone in the MAIN checkout. Apply the batch below IN ORDER, one commit per finding ID, message format: review: <ID> — <one-liner>. An agreeing cross-axis pair (pairWith set on both members) applies as ONE commit covering both IDs — review: <ID>+<ID> — <one-liner>: when you reach the first member, apply both together and skip the partner when its turn comes.',
    'FIRST ACT — re-derive both preconditions yourself; never trust values threaded through this prompt:',
    '- git status --porcelain → if the tree is dirty, apply NOTHING: demote every finding, kind=preconditions, reason "demoted: dirty tree". Never commit around a user\'s uncommitted work.',
    '- git rev-parse --abbrev-ref HEAD → if HEAD is the repo\'s default branch and no user OK is quoted below, apply NOTHING: demote everything, kind=preconditions, reason "demoted: on default branch without OK".',
    '- If a precondition cannot be verified at all, demote with kind=preconditions, reason "demoted: couldn\'t verify preconditions" — the distinct wording matters; only that one is a bug to chase.',
    DEFAULT_BRANCH_OK ? 'User\'s default-branch OK, verbatim: ' + JSON.stringify(DEFAULT_BRANCH_OK) : 'The user gave NO default-branch OK.',
    'Anchor each edit by the proposal\'s quoted snippet, never by line number. A finding whose staleAfter lists earlier IDs: those fixes may have invalidated this proposal\'s premise or wording — re-ground it against the code as it now stands before applying; if it no longer holds after those fixes, demote it, kind=other, saying why.',
    'After the whole batch: run the full test suite once; revert any finding-commit that breaks it and demote that finding, kind=test-failure, with the failure attached.',
    'Batch:',
    JSON.stringify(batch.map(f => ({ id: f.id, file: f.file, description: f.description, proposal: f.proposal, sketch: f.sketch, pairWith: f.pairWith || null, dependsOn: f.dependsOn || [], staleAfter: f.staleAfter || [] }))),
  ])
}

function ticketAgentPrompt(batch) {
  return j([
    'You are the auto-ticket agent of a review pipeline — pure tracker mechanics, no code edits. Publish the validated findings below as tickets; their fixes are session-sized, so each ticket is work for a fresh agent session.',
    'Tracker operations:',
    TICKET_MECHANICS,
    SPEC_ISSUE_REF
      ? 'Make each ticket a child of spec issue ' + SPEC_ISSUE_REF + ', labels: impl + ready-for-agent + review-finding — the ship frontier picks these up with no extra wiring.'
      : 'No tracker spec issue — publish standalone tickets, labels: ready-for-agent + review-finding.',
    'Cluster by file: findings touching the same file(s) become ONE ticket while the combined work still fits a single fresh session; past that cap, split into independent tickets with NO blocking edges — file overlap is not a blocker.',
    'Each ticket body: the findings, why they matter (cited source), the validated proposals, anchors by file + short quoted snippet — never bare line numbers (they go stale).',
    'Batch:',
    JSON.stringify(batch.map(f => ({ id: f.id, file: f.file, description: f.description, citedSource: f.citedSource, proposal: f.proposal, sketch: f.sketch, demotedReason: f.demotedReason || '' }))),
    'Return every ticket you created with the finding IDs it covers.',
  ])
}

// ── Stage runners ────────────────────────────────────────────────────────────

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// One axis, labeled findings → validated, proposed, fix-validated queue.
// Shelved findings (already-ticketed / already-adjudicated) skip everything: no proposal, no validator, no route.
// The axis's findings run in chunks of CHUNK_SIZE, each chunk an independent
// validate → propose → validate-fix pipeline chain — no cross-chunk barriers, so
// wall-clock is the slowest chunk's chain, not the sum of each stage's slowest.
// One agent per chunk per stage: validators stay fresh and adversarial, and the
// proposer keeps cross-finding coherence within its chunk.
async function runAxis(axisName, labeled) {
  const shelved = labeled.filter(f => f.dedup === 'already-ticketed' || f.dedup === 'already-adjudicated')
  const inQueue = labeled.filter(f => f.dedup !== 'already-ticketed' && f.dedup !== 'already-adjudicated')

  // Whole-axis roster — fix validators see it so edge fields can name IDs outside their chunk.
  const roster = inQueue.map(f => f.id + ' — ' + f.file + ': ' + f.description).join('\n')

  await pipeline(chunk(inQueue, CHUNK_SIZE),
    async (c, _, i) => {
      const r = await agent(findingValidatorPrompt(axisName, c),
        { schema: FINDING_VERDICTS_SCHEMA, phase: 'Validate findings', label: 'validate:' + axisName + ':' + (i + 1) })
      const verdicts = new Map(((r && r.verdicts) || []).map(v => [v.id, v]))
      for (const f of c) {
        const v = verdicts.get(f.id)
        // A validator that died keeps its finding — conservatively, and visibly.
        f.findingVerdict = v ? v.verdict : 'finding-validated'
        f.findingReason = v ? v.reason : 'validator result missing — kept unvalidated'
        f.specClassification = v ? v.specClassification : 'n/a'
        if (v && v.repoWideRaised) { f.repoWide = true; f.repoWideEvidence = v.repoWideEvidence }
      }
      return c.filter(f => f.findingVerdict === 'finding-validated')
    },
    async (survivors, _, i) => {
      if (!survivors.length) return survivors
      const props = await agent(proposerPrompt(axisName, survivors),
        { schema: PROPOSALS_SCHEMA, phase: 'Propose', label: 'propose:' + axisName + ':' + (i + 1) })
      const byId = new Map(((props && props.proposals) || []).map(p => [p.id, p]))
      for (const f of survivors) {
        const p = byId.get(f.id)
        f.proposal = p ? p.fix : 'proposal missing'
        f.sketch = p ? p.sketch : ''
        f.size = p ? p.size : 'needs-a-session'
      }
      return survivors
    },
    async (survivors, _, i) => {
      if (!survivors.length) return survivors
      const r = await agent(fixValidatorPrompt(axisName, survivors, roster),
        { schema: FIX_VERDICTS_SCHEMA, phase: 'Validate fixes', label: 'validate-fix:' + axisName + ':' + (i + 1) })
      const fvs = new Map(((r && r.verdicts) || []).map(v => [v.id, v]))
      for (const f of survivors) {
        const v = fvs.get(f.id)
        f.fixVerdict = v ? v.verdict : 'needs-human'
        f.fixReason = v ? v.reason : 'fix-validator result missing'
        // This stage has the last word on repo-wide — the routing step reads it from here.
        if (v) {
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
  const thunks = groups.map(g => () => agent(standardsReviewerPrompt(g), { phase: 'Review', label: 'review:std:' + g.name }))
  if (WIDE) thunks.push(() => agent(sweeperPrompt(), { phase: 'Review', label: 'review:std:cross-cutting' }))
  const reports = (await parallel(thunks)).filter(Boolean)
  const labeled = await agent(labelPrompt('STD', 'Standards', reports), { schema: FINDINGS_SCHEMA, phase: 'Label', label: 'label:std' })
  return runAxis('Standards', labeled ? labeled.findings : [])
}

async function specAxis(groups, requirements) {
  if (!SPEC) {
    log('No spec available — Spec axis skipped')
    return { skipped: true, survivors: [], refuted: [], shelved: [] }
  }
  const reviews = (await parallel(groups.map(g => () =>
    agent(specReviewerPrompt(g), { schema: SPEC_REVIEW_SCHEMA, phase: 'Review', label: 'review:spec:' + g.name })))).filter(Boolean)
  const reports = reviews.map(r => r.report)

  // Missing requirements are a property of the union, not any slice.
  if (WIDE && requirements.length) {
    const touched = new Set(reviews.flatMap(r => r.requirementsTouched))
    const unclaimed = requirements.filter(q => !touched.has(q))
    if (unclaimed.length) {
      const checks = (await parallel(unclaimed.map(q => () =>
        agent(checkerPrompt(q), { schema: CHECKER_SCHEMA, phase: 'Review', label: 'check:coverage' })
          .then(c => ({ q, c }))))).filter(Boolean)
      const missing = checks.filter(x => x.c.status === 'missing' || x.c.status === 'partial')
      if (missing.length) {
        reports.push('Requirement-coverage check (requirements no slice claimed):\n' +
          missing.map(x => '- ' + x.q + ': ' + x.c.status + ' — ' + x.c.note).join('\n'))
      }
    }
  }
  const labeled = await agent(labelPrompt('SPEC', 'Spec', reports), { schema: FINDINGS_SCHEMA, phase: 'Label', label: 'label:spec' })
  return runAxis('Spec', labeled ? labeled.findings : [])
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

let groups = [{ name: 'whole-diff', paths: null, decisionIds: [], diffCmd: DIFF_CMD }]
let requirements = []
if (WIDE) {
  phase('Partition')
  const p = await agent(partitionPrompt(), { schema: PARTITION_SCHEMA, label: 'partition' })
  if (p && p.groups.length) {
    groups = p.groups.map(g => ({ name: g.name, paths: g.paths, decisionIds: g.decisionIds, diffCmd: DIFF_CMD + ' -- ' + g.paths.join(' ') }))
    requirements = p.requirements
    log('Partitioned into ' + groups.length + ' groups: ' + groups.map(g => g.name).join(', '))
  } else {
    log('Partition agent failed — falling back to whole-diff reviewers')
  }
}

// The two axes run as independent chains — a Standards finding needn't wait for
// the Spec reviewer — and within an axis, chunks of findings flow through
// validate → propose → validate-fix as independent pipeline chains. The
// deliberate barriers all live below: routing, the serial fix agent, the ticket agent.
const axes = await parallel([() => standardsAxis(groups), () => specAxis(groups, requirements)])
const std = axes[0] || { survivors: [], refuted: [], shelved: [] }
const spec = axes[1] || { skipped: !SPEC, survivors: [], refuted: [], shelved: [] }

// Cross-axis pairs: same file, overlapping lines — usually one defect wearing two
// labels, and their fixes can compete. A pair routes as a unit.
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

// Settle each pair: do the two validated fixes agree or compete?
if (pairList.length) {
  const settled = await parallel(pairList.map(([a, b]) => () =>
    agent(pairPrompt(a, b), { schema: PAIR_SCHEMA, phase: 'Validate fixes', label: 'pair:' + a.id + '+' + b.id })))
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
  if (f.specClassification === 'spec-suspect') { f.route = 'escalate'; f.questionClass = 'spec-unclear' }
  else if (f.crossAxisPair && f.pairResolution === 'competing') { f.route = 'escalate'; f.questionClass = 'competing-fixes' }
  else if (f.repoWide) { f.route = 'escalate'; f.questionClass = 'pervasive-pattern' }
  else if (f.fixVerdict === 'needs-human') { f.route = 'escalate'; f.questionClass = 'genuine-trade-off' }
  else if (f.fixVerdict === 'fix-rejected') { f.route = 'escalate'; f.questionClass = 'no-working-fix' }
  else if (f.size === 'quick-fix') { f.route = 'auto-apply' }
  else { f.route = 'auto-ticket' }
}

// Edges and pairs route together — escalation dominates, then ticket, then apply.
// dependsOn and pair partners drag a finding up to the partner's tier; a proposal
// invalidatedBy an escalated finding escalates with it, while one invalidatedBy an
// auto-applying fix just gets re-grounded by the fix agent (staleAfter).
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

// Agreeing pairs that both auto-apply land as one commit covering both IDs.
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
  apply = (await agent(fixAgentPrompt(ordered), { schema: APPLY_SCHEMA, label: 'fix:auto-apply', model: 'sonnet' })) ||
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

// Auto-ticket — after the fix agent, so precondition demotions land in this batch.
const autoTicket = all.filter(f => f.route === 'auto-ticket')
let tickets = []
if (autoTicket.length && TICKET_MECHANICS) {
  const t = await agent(ticketAgentPrompt(autoTicket), { schema: TICKET_SCHEMA, label: 'ticket:auto', model: 'sonnet', effort: 'low' })
  tickets = (t && t.tickets) || []
  const covered = new Set(tickets.flatMap(x => x.findingIds))
  for (const f of autoTicket) {
    if (covered.has(f.id)) {
      f.status = 'auto-ticketed'
      f.ticketRef = (tickets.find(x => x.findingIds.includes(f.id)) || {}).ref
    } else {
      // Not published — hand it back to the manager rather than lose it.
      f.status = 'ticket-pending-manager'
    }
  }
} else if (autoTicket.length) {
  // No tracker mechanics were provided — the manager files these in step 12.
  for (const f of autoTicket) f.status = 'ticket-pending-manager'
}

const escalations = all.filter(f => f.route === 'escalate')
for (const f of escalations) f.status = 'escalated'

log('Routing: ' + apply.applied.length + ' auto-applied, ' +
  all.filter(f => f.status === 'auto-ticketed').length + ' auto-ticketed (' + tickets.length + ' tickets), ' +
  escalations.length + ' escalated' +
  (all.some(f => f.status === 'ticket-pending-manager') ? ', ' + all.filter(f => f.status === 'ticket-pending-manager').length + ' tickets pending the manager' : ''))

// The full routed queue — all the manager ever sees of this pipeline.
return {
  standards: { queue: std.survivors, refuted: std.refuted, shelved: std.shelved },
  spec: { skipped: !!spec.skipped, queue: spec.survivors, refuted: spec.refuted, shelved: spec.shelved },
  autoApplied: apply.applied,
  autoTicketed: tickets,
  ticketPendingManager: all.filter(f => f.status === 'ticket-pending-manager').map(f => f.id),
  escalations: escalations.map(f => ({
    id: f.id, file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd,
    description: f.description, citedSource: f.citedSource,
    questionClass: f.questionClass, joinedTo: f.joinedTo || null,
    crossAxisPair: f.crossAxisPair || null, pairResolution: f.pairResolution || null, pairReason: f.pairReason || null,
    specClassification: f.specClassification, proposal: f.proposal, sketch: f.sketch, size: f.size,
    fixVerdict: f.fixVerdict, fixReason: f.fixReason,
    repoWide: !!f.repoWide, repoWideEvidence: f.repoWideEvidence || '',
    instancesInDiff: f.instancesInDiff || 0, instancesOutsideDiff: f.instancesOutsideDiff || 0,
    demotedReason: f.demotedReason || null,
  })),
  testSummary: apply.testSummary,
  partitioned: WIDE ? groups.map(g => g.name) : null,
}
