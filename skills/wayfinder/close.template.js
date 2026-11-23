export const meta = {
  name: 'wayfinder-close',
  description: 'Close a wayfinder effort. Review mode: a cross-piece sweep and a requirements union over the whole effort diff → checkers → adversarial validation in chunks → survivors filed as pieces. Report mode: the closing report, stored for the human who takes the effort branch into its base',
  phases: [
    { title: 'Review', detail: 'review mode: an auditor-tier cross-piece sweeper and an auditor-tier requirements union over the whole diff; a decider-tier checker per suspect' },
    { title: 'Validate', detail: 'review mode: fresh decider-tier validators try to refute each finding, in chunks of five' },
    { title: 'File', detail: 'review mode: one executor-tier agent files the survivors as pieces and posts the close summary on the plan' },
    { title: 'Report', detail: 'report mode: one decider-tier writer composes the closing report; one executor-tier agent posts it on the plan' },
  ],
}

// Template for a wayfinder Close workflow, in one of two modes. Review mode is the
// one look at the effort as a whole: parallel pieces never saw each other's code,
// so it hunts the drift between them and any charter requirement built nowhere,
// and files what survives validation as pieces back into the cycle. Report mode
// writes the closing report the human judges the effort by and stores it where
// the lead hands it over. This file owns every Close agent's prompt; SKILL.md and LEAD.md say
// what Close is for, its order of steps, and what the lead does with each return.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes): JSON.stringify or
// Python's json.dumps, spliced in with a plain string replace — a regex
// replacement string turns the \n escapes back into raw newlines and the script
// no longer parses. Nothing goes through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const MODE = FILL            // "review" or "report" — the lead's brief says which
const PLAN_REF = FILL        // the plan issue as "#<n>", e.g. "#12"
const CHARTER = FILL         // the charter's full text verbatim, read from the effort branch at the path on the plan body's Charter: line
const BEHAVIORS = FILL       // every charter behavior, in charter order: [{ id: "B1", text: "the charter's B1 line verbatim" }]
const EFFORT_BRANCH = FILL   // the plan body's Effort branch: line, e.g. "effort/<slug>"
const BASE_BRANCH = FILL     // the branch the effort started from and returns to, e.g. "main" — `effort.py show` prints it as base
const BASE_SHA = FILL        // the effort's base: git merge-base <BASE_BRANCH> <EFFORT_BRANCH>
const HEAD_SHA = FILL        // the effort branch's head at fill time — the diff and the report describe this commit
const REPO_ROOT = FILL       // absolute path of the main checkout of the repo
const PASS = FILL            // review mode: this close pass's number k, counting from 1 (one more than the plan's <!-- wayfinder close <k> --> comments); report mode: the number of the last pass
const PRIOR_SUMMARIES = FILL // every <!-- wayfinder close <k> --> comment on the plan, verbatim, oldest first: ["..."] — [] if none
const DECISIONS = FILL       // every wayfinder:decision issue of the plan: [{ number: 33, title: "..." }] — [] if none
const VERIFY_REPORT = FILL   // report mode: the latest <!-- wayfinder verify <sha> --> comment on the plan, verbatim, with "comment <id> on #<plan>" on a first line of its own; "" in review mode
const VERIFY_SKILL = FILL    // repo path of the verify-<app> skill: the one the charter's verification line names, or, for a greenfield charter, the .claude/skills/verify-* directory on the effort branch that the walking-skeleton piece built, e.g. ".claude/skills/verify-web"

const EXECUTOR_MODEL = FILL  // per /model-policy: the executor tier's resolved model, or null to inherit
const DECIDER_MODEL = FILL   // per /model-policy: the decider tier's resolved model, or null to inherit
const AUDITOR_MODEL = FILL   // per /model-policy: the auditor tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the run genuinely deviates ═══════════

const TIER_MODEL = { executor: EXECUTOR_MODEL, decider: DECIDER_MODEL, auditor: AUDITOR_MODEL }
const tier = t => (TIER_MODEL[t] ? { model: TIER_MODEL[t] } : {})
const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')

const CHUNK_SIZE = 5 // findings per validator
const PREFIX = 'C' + PASS
const DIFF_CMD = 'git diff ' + BASE_SHA + '...' + HEAD_SHA
const LOG_CMD = 'git log ' + BASE_SHA + '..' + HEAD_SHA
// Each close summary states its result on this line, so the next pass can tell
// whether the one before it found anything; a systemic gap adds the second.
const RESULT_LINE = '**Result:** '
const SYSTEMIC_LINE = '**Systemic gap:** '

const CONTEXT = j([
  'You are an agent of a wayfinder effort: a build too big for one session, run unattended by agents from a charter the human wrote, as many pieces built in parallel and merged into ' + EFFORT_BRANCH + '. The plan is issue ' + PLAN_REF + '. Every piece has landed and the latest Verify proved every charter behavior; this is Close, the last look before the effort goes to the human, who takes ' + EFFORT_BRANCH + ' into ' + BASE_BRANCH + '.',
  'Work from ' + REPO_ROOT + ', and read the effort at ' + HEAD_SHA + ' without checking anything out: git show ' + HEAD_SHA + ':<path> for a file, git grep <pattern> ' + HEAD_SHA + ' to search. Change nothing in the repo. The effort\'s issues and changes are read with sc (run it with --help first) — never gh: this effort has no GitHub.',
  'The charter:',
  CHARTER,
])

const SCOPE = 'SCOPE — the effort diff is the material: run ' + DIFF_CMD + ' yourself, and ' + LOG_CMD + ' for the commits, whose messages carry deviation notes. A finding must name something the diff did — a line it added, changed, or removed — or a charter requirement the effort was meant to deliver and did not (an absence has no anchor). Code the diff never touched is out of scope however wrong it is.'

// ── Schemas ──────────────────────────────────────────────────────────────────

const SWEEP_SCHEMA = {
  type: 'object', required: ['hits'],
  properties: {
    hits: { type: 'array', items: { type: 'object', required: ['smell', 'description', 'hunks'], properties: {
      smell: { enum: ['Duplicated Code', 'Repeated Switches', 'Shotgun Surgery', 'Divergent Change'] },
      description: { type: 'string', description: 'one line: what drifted, in the domain\'s words' },
      hunks: { type: 'array', items: { type: 'string' }, description: 'each hunk involved: file plus a short quoted snippet' },
    } } },
  },
}

const UNION_SCHEMA = {
  type: 'object', required: ['suspects'],
  properties: {
    suspects: { type: 'array', items: { type: 'object', required: ['requirement', 'source'], properties: {
      requirement: { type: 'string', description: 'one line: the requirement you suspect is built nowhere' },
      source: { type: 'string', description: 'the charter line it comes from, quoted, with its behavior ID or section' },
    } } },
  },
}

const CHECKER_SCHEMA = {
  type: 'object', required: ['status', 'note'],
  properties: {
    status: { enum: ['implemented-pre-existing', 'implemented-in-diff', 'missing', 'partial'] },
    note: { type: 'string', description: 'one line of evidence: where it is implemented, or what you searched and did not find' },
  },
}

const VERDICT_FIELDS = {
  id: { type: 'string' },
  verdict: { enum: ['finding-validated', 'finding-refuted'] },
  reason: { type: 'string' },
  scope: { enum: ['introduced-by-diff', 'missing-requirement', 'pre-existing'], description: 'settled BEFORE the merits: pre-existing = the subject is code the effort diff never touched, and the script refutes it whatever its merits' },
  acceptance: { type: 'string', description: 'for a validated finding: one criterion an agent can check that holds once it is fixed — a charter behavior\'s B<n> line verbatim when the finding is that behavior unmet; "" when refuted' },
}
const VERDICTS_SCHEMA = {
  type: 'object', required: ['verdicts'],
  properties: { verdicts: { type: 'array', items: { type: 'object', required: Object.keys(VERDICT_FIELDS), properties: VERDICT_FIELDS } } },
}

const FILE_SCHEMA = {
  type: 'object', required: ['pieces', 'summaryComment', 'problems'],
  properties: {
    pieces: { type: 'array', items: { type: 'object', required: ['id', 'number'], properties: { id: { type: 'string' }, number: { type: 'integer' } } }, description: 'every piece you created, by its finding ID' },
    summaryComment: { type: 'integer', description: 'the id of the summary comment on the plan; 0 when it was not posted' },
    problems: { type: 'string', description: 'any step you could not complete, and why; "" when every step landed' },
  },
}

const REPORT_SCHEMA = {
  type: 'object', required: ['title', 'body'],
  properties: {
    title: { type: 'string', description: 'the report\'s title: the charter\'s effort title' },
    body: { type: 'string', description: 'the closing report, in Markdown, without the title' },
  },
}

const STORE_SCHEMA = {
  type: 'object', required: ['report', 'problems'],
  properties: {
    report: { type: 'string', description: 'where the report is, as "comment <id> on #<plan>", its id being its position among the plan\'s comments counted from 1; "" when it could not be posted' },
    problems: { type: 'string', description: 'any step you could not complete, and why; "" when every step landed' },
  },
}

// ── Review prompts ───────────────────────────────────────────────────────────

function sweeperPrompt() {
  return j([
    CONTEXT,
    'You are the cross-piece sweeper. Each piece was built and reviewed on its own, by agents that never saw each other\'s code, so every per-piece review is blind to the seams between pieces. You read the whole effort diff.',
    SCOPE,
    'Read the diff at low resolution — the file list and hunk headers, reading closer only where something looks suspicious. Hunt ONLY four cross-file composition seams (Fowler, Refactoring ch.3): Duplicated Code, Repeated Switches, Shotgun Surgery, Divergent Change. The target is drift between parallel implementations, not style. Report each hit with its smell and the hunks involved, quoted. Every hit is a hypothesis a validator will try to refute; [] when there are none.',
  ])
}

function unionPrompt() {
  return j([
    CONTEXT,
    'You are the requirements union. Read every acceptance behavior and the whole Design section of the charter above against the effort diff\'s FILE LIST (' + DIFF_CMD + ' --stat), not the full diff, and list every requirement you suspect is implemented nowhere — a behavior, a part, an interface, or a flow the Design names.',
    SCOPE,
    DECISIONS.length ? 'The effort\'s shared decisions, which say how some requirements were met (read any you need with sc issue view <n>):\n' + DECISIONS.map(d => '- #' + d.number + ' ' + d.title).join('\n') : null,
    'Return only the suspects, each with the charter line it comes from — each goes to a checker before it becomes a finding. Absent from the changed files does not prove unimplemented; err toward listing a suspect over silence.',
  ])
}

function checkerPrompt(s) {
  return j([
    CONTEXT,
    'One charter requirement is suspected of being implemented nowhere in the effort.',
    'Requirement: ' + s.requirement,
    'From the charter: ' + s.source,
    'Check whether it is implemented at ' + HEAD_SHA + '. Absent from the changed files does not mean unimplemented — it may pre-exist; search the repo before you call it missing. partial means some of it is built and you can name what is not.',
  ])
}

function validatorPrompt(findings) {
  return j([
    CONTEXT,
    'You are a fresh adversarial validator of a Close review. You did not author these findings; your job is to try to REFUTE each one, on its own.',
    SCOPE,
    'Findings to validate:',
    JSON.stringify(findings.map(f => ({ id: f.id, kind: f.kind, description: f.description, evidence: f.evidence }))),
    'Settle SCOPE first, before the merits, and return it as the scope field: introduced-by-diff (every hunk it anchors to is a line the effort diff added, changed, or removed), missing-requirement (an absence — a charter requirement built nowhere), or pre-existing (its subject is code the diff never touched). A pre-existing finding is refuted on scope however real it is — check the anchor against the diff yourself rather than trusting the finder.',
    'Then the merits. A drift finding is real only when the hunks really do implement one thing in two places, switch on the same condition in several, scatter one change across files that should own it together, or load one module with unrelated reasons to change — and the harm survives what the code already shares. A missing-requirement finding is real only when you search the repo at ' + HEAD_SHA + ' and do not find it built.',
    PRIOR_SUMMARIES.length ? 'Earlier close passes, verbatim — a finding one of them refuted is refuted again, with its reason, unless the code it anchors to changed since; one they filed as a piece that has landed is real again only if the drift is still there:\n' + PRIOR_SUMMARIES.join('\n---\n') : null,
    'For each validated finding, write the acceptance its piece will carry: one criterion an agent can check that holds once it is fixed.',
  ])
}

function pieceBody(f) {
  const builds = DECISIONS.filter(d => f.evidence.includes('#' + d.number))
  return [
    '## Goal',
    'Close pass ' + PASS + ' of ' + PLAN_REF + ' found: ' + f.description + '\n\n' + f.evidence + '\n\nWhy it holds: ' + f.reason,
    '', '## Acceptance', '- ' + f.acceptance.replace(/\*\*/g, '').replace(/^\s*-\s*/, '').trim(),
    '', '## Builds on', ...(builds.length ? builds.map(d => '- #' + d.number + ' ' + d.title) : ['- none']),
  ].join('\n')
}

function filePrompt(survivors, summary) {
  return j([
    'You publish a wayfinder Close review. Work from ' + REPO_ROOT + '. This effort has no GitHub: its tracker, changes and commit statuses live in sc, this machine\'s forge, reached only through the sc command (run sc --help, and sc <noun> <verb> --help, before first use; every read takes --json, and a body or comment is passed as --body "$(cat <file>)", in a command of its own after the one that writes the file, with the $ unescaped: \\$(cat <file>) posts those characters as the body). Never run gh. Labels are /issue-tracker\'s vocabulary (load it). The plan is issue ' + PLAN_REF + '. Do every step exactly once: if an earlier run of this step already did one — a piece with the same title open under the plan, the summary already posted — reuse it rather than repeating it.',
    survivors.length
      ? '1. Create each piece below as a piece of the plan — issue create with --parent set to the plan\'s number, labelled impl — with exactly the title and body given. Add no blocking edges.\n' + survivors.map(f => '--- ' + f.id + ' ---\nTitle: ' + f.title + '\nBody:\n' + pieceBody(f)).join('\n')
      : '1. There are no pieces to create.',
    '2. Post this comment on the plan, replacing each {{piece:<id>}} with the piece created for that finding ID as its title followed by its number — Title (#<n>); report the comment\'s id as summaryComment:\n' + summary,
  ])
}

// ── Report prompts ───────────────────────────────────────────────────────────

function writerPrompt(systemic) {
  return j([
    CONTEXT,
    'You write the closing report: the one document the human reads to accept this effort into ' + BASE_BRANCH + '. They held only the charter; they did not watch the run. Everything they need to judge it is in this report, and nothing they need to dig for. In everything you write, refer to the plan, a piece, or a decision by its title followed by its number — Title (#12) — and a change as Title (change 5), never by a bare number; nothing here has a link.',
    'The latest Verify report on the plan, verbatim:',
    VERIFY_REPORT,
    DECISIONS.length ? 'The effort\'s shared decisions:\n' + DECISIONS.map(d => '- ' + d.title + ' (#' + d.number + ')').join('\n') : 'The effort has no shared decisions.',
    PRIOR_SUMMARIES.length ? 'The close passes, verbatim, oldest first:\n' + PRIOR_SUMMARIES.join('\n---\n') : null,
    'Read what else you need with sc from ' + REPO_ROOT + ': the landed changes into ' + EFFORT_BRANCH + ' (change list --state landed --json, then change view — their Decisions and Deviations sections), the decision-record comments and friction notes on the plan\'s pieces and decisions, the plan\'s steer summaries, and its open issues (issue list), including every open issue labelled review-finding.',
    'The report has these sections, in this order:',
    '- **What was built** — the destination as delivered, in a paragraph, and the major parts as the Design names them.',
    '- **Acceptance behaviors** — every charter behavior, by its ID and line, with its status and the evidence the Verify report gives for it, naming that report by the comment reference on its first line.',
    '- **Decisions that mattered** — the calls a reviewer would want to know were made: one-way doors, calls a principle settled between real alternatives, and decisions that were amended or superseded. Each one line, naming the decision and where its record is (comment <id> on #<n> for a call recorded on a piece). Leave out the routine.',
    '- **Deviations from the charter** — every place the effort departs from its Design, Principles, or Out of scope, and why; "none" when there are none.',
    '- **Known issues** — open issues the effort left (escalations still unanswered, pieces still open), and anything the Verify report shows short of proven.',
    '- **Follow-ups** — every open issue labelled review-finding, each with its title, number and one line of what it asks. They were filed for later and live only in sc on this machine, so this list is where the human finds them; "none" when there are none.',
    systemic ? '- **Systemic gap** — two close passes in a row found new problems, which means the plan or the standards have a gap the run could not close on its own. Say so plainly, name the pattern across the two passes\' findings, and say the effort comes to the human with these known issues rather than looping again.' : null,
    '- **How to run it** — from the Launch section of the verify skill at ' + VERIFY_SKILL + ' (git show ' + HEAD_SHA + ':' + VERIFY_SKILL + '/SKILL.md): the commands a human runs to see it working.',
    '- **How to take it** — the last section, exactly these steps: review the whole effort with git diff ' + BASE_SHA + '...' + EFFORT_BRANCH + ' (the report describes ' + HEAD_SHA + '); merge ' + EFFORT_BRANCH + ' into ' + BASE_BRANCH + '; then tell the lead it is merged, or tell the lead what to change instead.',
    'State what is true at ' + HEAD_SHA + ', not the story of the run.',
  ])
}

function storePrompt(report) {
  return j([
    'You store the closing report of a wayfinder effort. Work from ' + REPO_ROOT + '. This effort has no GitHub: its tracker, changes and commit statuses live in sc, this machine\'s forge, reached only through the sc command (run sc --help, and sc <noun> <verb> --help, before first use; every read takes --json, and a body or comment is passed as --body "$(cat <file>)", in a command of its own after the one that writes the file, with the $ unescaped: \\$(cat <file>) posts those characters as the body). Never run gh. Labels are /issue-tracker\'s vocabulary. The plan is issue ' + PLAN_REF + '.',
    'Write the report below to a file under $TMPDIR, verbatim — the title as a level-one heading, then the body — with <!-- wayfinder report --> on a first line of its own above it, and post that file as one comment on the plan (sc issue comment <plan> --body "$(cat <that file>)"). The newest such comment is the effort\'s closing report, so post it even when an earlier run posted one. Report where it is.',
    'Title: ' + report.title,
    'Body:\n' + report.body,
    'Then comment on the plan, one line: the closing report for ' + HEAD_SHA + ' is posted and ' + EFFORT_BRANCH + ' is ready for the human to take into ' + BASE_BRANCH + '.',
  ])
}

// ── Report mode ──────────────────────────────────────────────────────────────

if (MODE === 'report') {
  // Any pass that found a systemic gap puts it in the report, whatever the passes after it found.
  const systemic = PRIOR_SUMMARIES.some(s => s.includes(SYSTEMIC_LINE))
  phase('Report')
  const report = await agent(writerPrompt(systemic), { ...tier('decider'), schema: REPORT_SCHEMA, label: 'write:closing-report', phase: 'Report' })
  if (!report) throw new Error('The closing-report writer died; no report was stored')
  const stored = await agent(storePrompt(report), { ...tier('executor'), schema: STORE_SCHEMA, label: 'store:closing-report', phase: 'Report' })
  if (!stored || !stored.report) throw new Error('The closing report was not stored' + (stored && stored.problems ? ': ' + stored.problems : ''))
  if (stored.problems) log('Closing report: ' + stored.problems)
  log('Closing report posted as ' + stored.report + (systemic ? ', with the systemic gap noted' : ''))
  return { status: 'reported', report: stored.report }
}

// ── Review mode: find ────────────────────────────────────────────────────────

phase('Review')
const found = await parallel([
  () => agent(sweeperPrompt(), { ...tier('auditor'), schema: SWEEP_SCHEMA, label: 'review:cross-piece-sweeper', phase: 'Review' }),
  () => agent(unionPrompt(), { ...tier('auditor'), schema: UNION_SCHEMA, label: 'review:requirements-union', phase: 'Review' }),
])
const sweep = found[0]
const union = found[1]
// Either finder dead means this pass saw only half the effort: it cannot call the effort clean.
if (!sweep || !union) throw new Error('The ' + (!sweep ? 'cross-piece sweeper' : 'requirements union') + ' died; a pass that saw half the effort cannot call it clean')

const suspects = union.suspects
const checks = await parallel(suspects.map(s => () =>
  agent(checkerPrompt(s), { ...tier('decider'), schema: CHECKER_SCHEMA, label: 'check:requirement', phase: 'Review' })))

const findings = []
sweep.hits.forEach((h, i) => findings.push({
  id: PREFIX + '-DRIFT-' + (i + 1), kind: 'drift',
  title: h.smell + ': ' + h.description,
  description: h.smell + ' — ' + h.description,
  evidence: h.hunks.map(x => '- ' + x).join('\n'),
}))
let reqN = 0
suspects.forEach((s, i) => {
  const c = checks[i]
  // A checker that died leaves its suspect a suspect: the validator searches for it itself.
  if (c && c.status !== 'missing' && c.status !== 'partial') return
  reqN++
  findings.push({
    id: PREFIX + '-REQ-' + reqN, kind: 'missing-requirement',
    title: (c && c.status === 'partial' ? 'Finish: ' : 'Build: ') + s.requirement,
    description: s.requirement + (c ? ' (' + c.status + ')' : ' (unchecked — the checker died)'),
    evidence: 'From the charter: ' + s.source + (c ? '\n\nChecker: ' + c.note : ''),
  })
})

// ── Review mode: validate ────────────────────────────────────────────────────

const chunks = []
for (let i = 0; i < findings.length; i += CHUNK_SIZE) chunks.push(findings.slice(i, i + CHUNK_SIZE))
if (chunks.length) phase('Validate')
await parallel(chunks.map((c, i) => async () => {
  let r = await agent(validatorPrompt(c), { ...tier('decider'), schema: VERDICTS_SCHEMA, label: 'validate:' + (i + 1), phase: 'Validate' })
  // One fresh retry for a dead validator; a finding still without a verdict is recorded
  // unvalidated and filed as nothing.
  if (!r) r = await agent(validatorPrompt(c), { ...tier('decider'), schema: VERDICTS_SCHEMA, label: 'revalidate:' + (i + 1), phase: 'Validate' })
  const byId = new Map(((r && r.verdicts) || []).map(v => [v.id, v]))
  for (const f of c) {
    const v = byId.get(f.id)
    if (!v) { f.outcome = 'unvalidated'; f.reason = 'no validator verdict'; continue }
    f.reason = v.reason
    f.acceptance = v.acceptance
    // Scope is settled before merits, by the script: code the effort never touched leaves here.
    if (v.scope === 'pre-existing') { f.outcome = 'refuted'; f.reason = 'out of scope — anchored to code the effort diff never touched: ' + v.reason; continue }
    f.outcome = v.verdict === 'finding-validated' && v.acceptance ? 'filed' : 'refuted'
  }
}))

// ── Review mode: file and summarize ──────────────────────────────────────────

const survivors = findings.filter(f => f.outcome === 'filed')
const last = PRIOR_SUMMARIES[PRIOR_SUMMARIES.length - 1] || ''
const systemic = survivors.length > 0 && PASS >= 2 && last.includes(RESULT_LINE + 'findings')
const OUTCOME = {
  filed: f => 'filed as {{piece:' + f.id + '}}',
  refuted: f => 'refuted — ' + f.reason,
  unvalidated: () => 'unvalidated (its validator died twice) — not filed; a later pass re-finds it if it is real',
}
const summary = [
  '<!-- wayfinder close ' + PASS + ' -->',
  '## Close pass ' + PASS + ' at ' + HEAD_SHA.slice(0, 7),
  '',
  RESULT_LINE + (survivors.length ? 'findings' : 'clean'),
  systemic ? '\n' + SYSTEMIC_LINE + 'the pass before this one also found new problems, so the plan or the standards have a gap the run is not closing; these are filed, and the closing report will say so rather than loop again.' : null,
  '',
  findings.length ? findings.map(f => '- **' + f.id + '** ' + f.description + ' — ' + OUTCOME[f.outcome](f)).join('\n') : 'No finding: the sweep found no drift between pieces, and every charter requirement is built.',
].filter(x => x !== null).join('\n')

phase('File')
const filed = await agent(filePrompt(survivors, summary), { ...tier('executor'), schema: FILE_SCHEMA, label: 'file:close-' + PASS, phase: 'File' })
if (!filed) throw new Error('The filing agent for close pass ' + PASS + ' died; pieces and summary may be partly posted — a relaunch reuses what landed')
if (filed.problems) log('Close pass ' + PASS + ': ' + filed.problems)

log('Close pass ' + PASS + ': ' + findings.length + ' findings, ' + survivors.length + ' filed' + (systemic ? ', systemic' : ''))
const result = { status: survivors.length ? 'findings' : 'clean', pieces: filed.pieces.map(p => p.number), summary: survivors.length + ' of ' + findings.length + ' findings filed as pieces' }
if (systemic) result.systemic = true
return result
