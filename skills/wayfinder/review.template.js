export const meta = {
  name: 'wayfinder-review',
  description: 'One review round of one wayfinder piece change: spec and standards reviewers over the change diff → label and dedup against prior rounds → validate findings → propose → validate fixes → route by script → post the round comment and the reviewer statuses',
  phases: [
    { title: 'Locate', detail: 'executor-tier agent puts the review worktree at the change head and finds the merge-base' },
    { title: 'Review', detail: 'decider-tier spec reviewer (re-drives at least one behavior) and standards reviewer (written rules only; idle with no sources)' },
    { title: 'Label', detail: 'one decider-tier labeler per axis: IDed findings, deduped against prior rounds and open review-finding issues' },
    { title: 'Validate findings', detail: 'fresh decider-tier adversarial validators, chunked; refuted findings leave here' },
    { title: 'Propose', detail: 'one decider-tier proposer per chunk; one redraft for repairs rejected on their text' },
    { title: 'Validate fixes', detail: 'fresh decider-tier fix validators, chunked; cross-axis pair resolution' },
    { title: 'Route', detail: 'script routing: changes for fix mode, questions with blocks from a fresh decider-tier assembler, repo-wide patterns to standalone issues' },
    { title: 'Post', detail: 'executor-tier agent files repo-wide issues, posts the round comment and the wayfinder/spec and wayfinder/standards statuses, removes the worktree' },
  ],
}

// Template for one round of the /wayfinder Review stage: the /finding-pipeline
// code gate over one piece's change, scoped to that change's own diff. This file owns
// every review agent's prompt; SKILL.md says what the stage is for and LEAD.md
// what the lead does with the return. Nothing here fixes code or files tickets
// for the piece: every validated finding goes back to the piece's own build in
// fix mode, and only intent questions and repo-wide patterns route elsewhere.
// The lead holds this workflow's claim (pending reviewer statuses at the head);
// the Post stage replaces them with the round's verdicts.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch — loud,
// before any agent spawns. Fill prose slots as JSON string literals (double
// quotes, \n escapes): JSON.stringify or Python's json.dumps, spliced in with a
// plain string replace — a regex replacement string turns the \n escapes back
// into raw newlines and the script no longer parses. Nothing goes through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const PLAN = FILL              // the plan issue: { number: 12, title: "its title" }
const CHANGE = FILL            // the piece's change: { number: 5, title: "its title" } — change numbers are their own sequence, separate from issue numbers
const HEAD_SHA = FILL          // the change head commit under review, full sha — the one whose CI is green (the head that WF_CMD change show <change> prints)
const PIECE = FILL             // the piece the change closes: { number: 41, title, body: "the issue body verbatim — Goal, Acceptance, Builds on" }
const DECISIONS = FILL         // every decision under the piece's Builds on, full text: [{ number: 30, title, body: "the decision issue body verbatim" }] — [] when it builds on none
const CHARTER_PATH = FILL      // the plan body's Charter: line, e.g. "docs/wayfinder/<slug>.md" — agents read it from the review worktree
const EFFORT_BRANCH = FILL     // the plan body's Effort branch: line, e.g. "effort/<slug>" — the change's base
const ROUND = FILL             // this round's number: 1 + the count of <!-- wayfinder review <n> --> comments already on the change (a comment for this same round left by a dead run does not count)
const PRIOR_ROUNDS = FILL      // every <!-- wayfinder review <n> --> comment on this change from earlier rounds, verbatim, oldest first: ["..."] — [] in round 1
const PRIOR_ANSWERS = FILL     // the answers given to earlier rounds' questions, verbatim — the <!-- wayfinder review-answers <round> --> comments on this change, and the decision records posted on the piece since round 1 that answer a review question: ["..."] — [] when none
const STANDARDS_SOURCES = FILL // per /conventions, the standards files governing the change's changed files: [{ path: "CONVENTIONS.md", scope: "repo root" }] — [] idles the standards axis
const VERIFY_SKILL = FILL      // the verify-<app> skill's path from the repo root, e.g. ".claude/skills/verify-web" — "" when this change is the one that builds it
const APP = FILL               // the <app> of verify-<app> (the app's workspace or directory name), e.g. "web" — names the drive pool
const REPO_ROOT = FILL         // absolute path of the main checkout
const WORKTREE = FILL          // absolute path of the review worktree: <REPO_ROOT>/.claude/worktrees/<slug>/review-<change number>
const SLOT_CMD = FILL          // absolute path of the installed wayfinder skill's slot.sh
const BUILD_SLOTS = FILL       // the charter's Limits → Build slots, as a number
const DRIVE_SLOTS = FILL       // the charter's Limits → Drive slots, as a number
const WF_CMD = FILL            // the effort's forge command: "<absolute path of the installed wayfinder skill's wf.py> --effort <slug>"
const TEST_NOTES = FILL        // per /testing: the governing TESTING.md sections verbatim (Typecheck, Unit, Integration, Scoping to a change, Green — each with the scope it binds), or "" when the repo has none

const EXECUTOR_MODEL = FILL    // per /model-policy: the executor tier's resolved model, or null to inherit
const DECIDER_MODEL = FILL     // per /model-policy: the decider tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the run genuinely deviates ═══════════

const TIER_MODEL = { executor: EXECUTOR_MODEL, decider: DECIDER_MODEL }
const tier = t => (TIER_MODEL[t] ? { model: TIER_MODEL[t] } : {})
const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')
const md = lines => lines.filter(s => s !== null && s !== undefined).join('\n') // keeps blank lines, which markdown needs

const CHUNK_SIZE = 5 // findings per chunk — each chunk rides its own validate → propose → validate-fix chain
const PREFIX = 'R' + ROUND
const STANDARDS_IDLE = !STANDARDS_SOURCES.length
// Nothing has a link: a human reads an issue as its title and number, a change as its title and change number.
const ref = x => x.title + ' (#' + x.number + ')'
const changeRef = x => x.title + ' (change ' + x.number + ')'
const FORGE_RULE = 'This effort has no GitHub: its tracker, changes and commit statuses live in a local store reached only through ' + WF_CMD + ' (run it with --help, and <command> --help, before first use). Never read or write the store\'s files directly and never run gh. Labels are /issue-tracker\'s vocabulary.'

// Set by the Locate stage: the change's merge-base with the effort branch.
let BASE = ''
const diffCmd = () => 'git diff ' + BASE + '...' + HEAD_SHA
const logCmd = () => 'git log ' + BASE + '..' + HEAD_SHA

// Canonical wording: /finding-pipeline, "The diff is the material".
const SCOPE_RULE = 'SCOPE — the diff is the material. A finding must name something the diff DID: a line it added, changed, or removed. Code the diff never touched is out of scope however wrong it is, and whether or not an issue already covers it. You will legitimately see far more code than you may report on — diff context lines, the repo grep behind a repo-wide flag, the files you open to check a rule — and none of it is reportable on its own. Two cases are in scope and only look like exceptions: a requirement this piece was meant to deliver and did not (an absence has no anchor), and the repo-wide counts, which are evidence about a pattern the diff instantiates, never findings about the untouched instances.'

// A workflow agent's turn ending is its final report, so it waits on a long run in the
// foreground, through await.sh beside slot.sh, never on a completion notice.
const AWAIT_CMD = SLOT_CMD.replace(/slot\.sh$/, 'await.sh')
const BUILD_SLOTS_RULE = 'Run every build and test command — compiles, test suites, anything from the test recipes — through the host\'s build slots: sh ' + SLOT_CMD + ' ' + BUILD_SLOTS + ' build -- <command>. It waits for a free slot, then runs the command. Run it in the foreground with the Bash timeout at its 600000 ms maximum. One that can outlast that: start it with run_in_background as <the slot command>; echo "exit: $?" — then wait for it in the foreground with sh ' + AWAIT_CMD + ' <its output file>, which returns within nine minutes saying finished or still running; call it again until it says finished. Never end your turn to wait: your turn ending is your final report, and it stops the run. A run you have not seen finish has no result yet.'

const DRIVE_SLOTS_RULE = 'Run every copy of the app through the host\'s drive slots: start it with its Launch command as sh ' + SLOT_CMD + ' ' + DRIVE_SLOTS + ' drive-' + APP + ' -- <launch command>, run_in_background, so the slot is held for as long as that copy runs; drive it; then tear it down per the skill\'s Cleanup, which ends the command and frees the slot. An app with no long-running process (a short-lived CLI) wraps each drive command the same way instead. Never drive a copy you did not start.'

// Every agent after Locate works in the review worktree, detached at the head.
function common() {
  return j([
    SCOPE_RULE,
    'Work in the review worktree ' + WORKTREE + ', detached at the change head ' + HEAD_SHA + ' — run every command there, and leave it as you found it: no commits, no edits that outlive your run. ' + changeRef(CHANGE) + ' proposes its piece branch for ' + EFFORT_BRANCH + ', a local branch: there is no remote, so never fetch or push, and never check ' + EFFORT_BRANCH + ' out, commit to it or move it. ' + FORGE_RULE,
    'Diff under review (run it yourself): ' + diffCmd() + '. Commits under review: ' + logCmd() + ' — full messages. The change body (' + WF_CMD + ' change show ' + CHANGE.number + ') carries the builder\'s evidence per behavior, its Decisions and its Deviations.',
  ])
}

const PIECE_CONTEXT = j([
  'The piece this change closes — ' + PIECE.title + ' (#' + PIECE.number + '). Its Acceptance is the spec this review holds the diff against:',
  PIECE.body,
  DECISIONS.length
    ? 'Full text of the decisions the piece builds on — binding, the same authority as the Acceptance:\n' + DECISIONS.map(d => '### ' + d.title + ' (#' + d.number + ')\n' + d.body).join('\n\n')
    : 'The piece builds on no shared decision.',
  'The effort\'s charter — Destination, Acceptance behaviors, Principles, Design, Out of scope — is ' + CHARTER_PATH + ' in the worktree: it is the context the piece was cut from, and a diff that breaks its Principles or Design is a spec finding.',
  'The builder\'s own calls are <!-- decision-record --> comments on the piece (' + WF_CMD + ' issue show ' + PIECE.number + ' prints them), each named in the change body\'s Decisions. A call recorded with grounds is the builder\'s to make where the Acceptance and the decisions are silent; it is a finding only where it contradicts them, the charter\'s Principles or Design, or its own grounds.',
  PRIOR_ANSWERS.length
    ? 'Answers to earlier rounds\' questions — BINDING, the same authority as a decision; a finding one of these directly governs diverges from the answer, it never raises the question again:\n' + PRIOR_ANSWERS.join('\n---\n')
    : null,
])

const AXIS_INPUTS = j([
  STANDARDS_IDLE
    ? 'No documented standards — the standards axis is idle this round.'
    : 'Standards sources (read the files yourself; a scoped CONVENTIONS.md governs only files under its directory, nearest scope winning; scoped files read as deltas over root):\n' + STANDARDS_SOURCES.map(s => '- ' + s.path + ' — binds ' + s.scope).join('\n'),
  PIECE_CONTEXT,
])

// ── Schemas ──────────────────────────────────────────────────────────────────

const LOCATE_SCHEMA = {
  type: 'object', required: ['ok', 'base', 'files', 'headIsCurrent', 'problem'],
  properties: {
    ok: { type: 'boolean', description: 'true when the worktree is at ' + HEAD_SHA + ' and the merge-base is found' },
    base: { type: 'string', description: 'git merge-base ' + EFFORT_BRANCH + ' ' + HEAD_SHA + ', full sha; "" when ok is false' },
    files: { type: 'array', items: { type: 'string' }, description: 'the changed files, from git diff --name-only <base>...' + HEAD_SHA },
    headIsCurrent: { type: 'boolean', description: 'whether the change\'s head is still ' + HEAD_SHA },
    problem: { type: 'string', description: 'what failed when ok is false; "" otherwise' },
  },
}

const SPEC_REVIEW_SCHEMA = {
  type: 'object', required: ['report', 'drove'],
  properties: {
    report: { type: 'string', description: 'the spec review report' },
    drove: {
      type: 'array', minItems: 1,
      description: 'every behavior you drove yourself at this head',
      items: {
        type: 'object', required: ['behavior', 'how', 'observed', 'holds'],
        properties: {
          behavior: { type: 'string', description: 'the B<n> and its text; "none" with the reason when the Acceptance names no B<n> line' },
          how: { type: 'string', description: 'what you ran and did, through the verify skill' },
          observed: { type: 'string', description: 'what you saw yourself, and where your evidence lives' },
          holds: { type: 'boolean', description: 'true when the end state the Acceptance names appeared and matches the change body\'s evidence' },
        },
      },
    },
  },
}

const FINDING_FIELDS = {
  id: { type: 'string' },
  kind: { enum: ['in-diff', 'absence'], description: 'absence = something the piece was meant to deliver and did not; it has no code to point at, so file is "" and lineStart/lineEnd are 0. Everything else is in-diff.' },
  file: { type: 'string', description: '"" when kind=absence — never invent an anchor for something that is not there' },
  lineStart: { type: 'integer', description: '0 when kind=absence' },
  lineEnd: { type: 'integer', description: '0 when kind=absence' },
  description: { type: 'string', description: 'one line' },
  repoWide: { type: 'boolean' },
  repoWideEvidence: { type: 'string', description: 'the grep plus both counts, or ""' },
  citedSource: {
    type: 'object', required: ['title', 'gist', 'quote', 'id'],
    description: 'the standard rule, Acceptance line, or decision the finding holds the code against — prose fields a cold-reader assembler writes from; the id is a handle, never the only thing carried',
    properties: {
      title: { type: 'string', description: 'the rule, Acceptance line, or decision title' },
      gist: { type: 'string', description: 'one line: what it requires, in the domain\'s terms' },
      quote: { type: 'string', description: 'the quoted sentence the finding turns on' },
      id: { type: 'string', description: 'B<n>, the decision issue number, or the CONVENTIONS.md path' },
    },
  },
  dedup: { enum: ['none', 'already-adjudicated', 'still-open-from-prior', 'already-ticketed', 'instance-of-open', 'possibly-duplicates'] },
  dedupRef: { type: 'string', description: 'the prior round\'s finding ID and outcome, or the issue #N; "" when dedup=none' },
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
  cost: { type: 'string', description: 'what breaks downstream if the finding simply stands — which behavior, decision, or rule; "nothing" when nothing does' },
}
const PROPOSALS_SCHEMA = {
  type: 'object', required: ['proposals'],
  properties: { proposals: { type: 'array', items: { type: 'object', required: Object.keys(PROPOSAL_FIELDS), properties: PROPOSAL_FIELDS } } },
}

const FIX_VERDICT_FIELDS = {
  id: { type: 'string' },
  verdict: { enum: ['validated', 'fix-rejected', 'needs-human'] },
  reason: { type: 'string' },
  rejectKind: { enum: ['text', 'substance'], description: 'required when verdict=fix-rejected, omitted otherwise: text = the repair is right but its own wording is wrong (a name that does not exist, a misquote, an anchor at the wrong code, or an addition to strip) and the reason states the correction; substance = the repair itself is wrong' },
  docOnly: { type: 'boolean', description: 'confirm or clear the proposal\'s claim — final word; true only when the fix touches no executable code' },
  repoWide: { type: 'boolean' },
  instancesInDiff: { type: 'integer' },
  instancesOutsideDiff: { type: 'integer' },
  dependsOn: { type: 'array', items: { type: 'string' } },
  invalidatedBy: { type: 'array', items: { type: 'string' } },
}
const FIX_VERDICTS_SCHEMA = {
  type: 'object', required: ['verdicts'],
  properties: { verdicts: { type: 'array', items: { type: 'object', required: Object.keys(FIX_VERDICT_FIELDS).filter(k => k !== 'rejectKind'), properties: FIX_VERDICT_FIELDS } } },
}

const PAIR_SCHEMA = {
  type: 'object', required: ['resolution', 'reason'],
  properties: {
    resolution: { enum: ['agreeing', 'competing'], description: 'agreeing = both fixes can land (compatible or identical in effect); competing = they cannot both land' },
    reason: { type: 'string' },
  },
}

const BLOCKS_SCHEMA = {
  type: 'object', required: ['blocks'],
  properties: {
    blocks: {
      type: 'array',
      items: {
        type: 'object', required: ['id', 'block'],
        properties: {
          id: { type: 'string', description: 'the escalation\'s finding ID' },
          block: { type: 'string', description: 'the full question block, markdown' },
        },
      },
    },
  },
}

const POST_SCHEMA = {
  type: 'object', required: ['posted', 'comment', 'issues', 'statuses', 'worktreeRemoved', 'problem'],
  properties: {
    posted: { type: 'boolean', description: 'true when the round comment and both statuses are in the effort\'s store' },
    comment: { type: 'integer', description: 'the id of the round comment on the change; 0 when it was not posted' },
    issues: { type: 'array', items: { type: 'object', required: ['id', 'title', 'number'], properties: { id: { type: 'string', description: 'the finding ID' }, title: { type: 'string' }, number: { type: 'integer', description: 'the filed issue\'s number' } } } },
    statuses: { type: 'array', items: { type: 'string' }, description: 'each status posted, as "<context> <state>"' },
    worktreeRemoved: { type: 'boolean' },
    problem: { type: 'string', description: 'what failed when posted is false; "" otherwise' },
  },
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function locatePrompt() {
  return j([
    'You are the locate agent of a wayfinder review round — git mechanics only, no review. Work from the main checkout ' + REPO_ROOT + '.',
    '1. Read change ' + CHANGE.number + '\'s current head: ' + WF_CMD + ' change show ' + CHANGE.number + ' (its head field; run ' + WF_CMD + ' --help first). There is no remote and nothing to fetch: every worktree shares one repo, so ' + HEAD_SHA + ' and the local branch ' + EFFORT_BRANCH + ' are already here. Never check ' + EFFORT_BRANCH + ' out.',
    '2. Put the review worktree ' + WORKTREE + ' at ' + HEAD_SHA + ', detached: create it with git worktree add --detach when it does not exist; when it does (an earlier round or a dead run), clean it (reset and remove untracked files) and check out ' + HEAD_SHA + ' detached there.',
    '3. Find the merge-base: git merge-base ' + EFFORT_BRANCH + ' ' + HEAD_SHA + ', and list the changed files with git diff --name-only <base>...' + HEAD_SHA + '.',
    'Report whether the change\'s head is still ' + HEAD_SHA + '. Any step that fails: ok=false with exactly what failed.',
  ])
}

function specReviewerPrompt() {
  return j([
    'You are the Spec reviewer of one wayfinder piece change, review round ' + ROUND + ': did this change deliver what its piece asked for, and does its evidence hold up? This is a verification gate, not a taste review.',
    common(),
    PIECE_CONTEXT,
    'Re-drive at least one behavior yourself, at this head, in the worktree: pick the Acceptance B<n> line the diff bears on most (more when time allows), drive it the way a user reaches it ' + (VERIFY_SKILL ? 'through the verify skill at ' + VERIFY_SKILL + ' — read its SKILL.md and follow its Launch, Doctor, Drive, Evidence, and Cleanup' : 'through the verify skill this change itself adds under .claude/skills/ in the worktree — read its SKILL.md and follow its Launch, Doctor, Drive, Evidence, and Cleanup') + ', and compare what you see with the end state the Acceptance names and the evidence the change body claims. Record each drive in drove. A behavior you could not drive to its end state, whatever blocked it, is a finding in your report with what blocked it.',
    DRIVE_SLOTS_RULE,
    BUILD_SLOTS_RULE,
    TEST_NOTES ? 'Test recipes (per /testing), for any test you run to check a claim:\n' + TEST_NOTES : null,
    'Report: (a) Acceptance lines missing or partial — every line, B<n> and otherwise; (b) evidence that does not hold up — a Behaviors line whose evidence is missing, is not where it says, does not show the end state, or contradicts what you saw driving it; a behavior the change claims proven whose feature file under the verify skill\'s feature map still carries its pending marker; (c) behavior the piece\'s Goal did not ask for (scope creep); (d) anything implemented against a decision above, the charter\'s Principles or Design, or a binding earlier answer — treat a decision\'s snippets, schemas, and contracts as requirements; (e) a call the Acceptance and the decisions do not settle, made without a decision record on the piece, where a different owner could defensibly want a different behaviour — silence plus one defensible choice is not a finding. Quote the Acceptance line or decision sentence per finding, with its B<n> or decision title. Under 400 words.',
  ])
}

function standardsReviewerPrompt() {
  return j([
    'You are the Standards reviewer of one wayfinder piece change, review round ' + ROUND + ': does the change\'s diff break a DOCUMENTED standard? This is a verification gate, not a taste review.',
    common(),
    'Standards sources (read the files yourself; a scoped CONVENTIONS.md governs only files under its directory, nearest scope winning; scoped files read as deltas over root):\n' + STANDARDS_SOURCES.map(s => '- ' + s.path + ' — binds ' + s.scope).join('\n'),
    'Report — per file/hunk where relevant — every place the diff violates a WRITTEN rule: cite the standard (file + rule) for each. If no written rule covers something, it is not a finding — do not report taste, smells, or conventions you would personally prefer. A finding that looks like a pattern with a statable grep signature: grep outside the diff and flag repo-wide only with the grep and both counts attached. Skip anything tooling enforces. Under 300 words.',
    'Your final text IS the report.',
  ])
}

function labelPrompt(axisPrefix, axisName, reports) {
  return j([
    'You are the labeling stage of a wayfinder review round — normalize raw reviewer reports into a list of discrete findings (light cleaning, no re-reviewing).',
    SCOPE_RULE,
    'Work in the review worktree ' + WORKTREE + '; the diff is ' + diffCmd() + '.',
    'Axis: ' + axisName + '. Assign IDs ' + PREFIX + '-' + axisPrefix + '-1, ' + PREFIX + '-' + axisPrefix + '-2, ... in report order.',
    'Reviewer reports:',
    reports.map((r, i) => '--- report ' + (i + 1) + ' ---\n' + r).join('\n'),
    'Set kind on each finding: absence for anything the reviewer reported as delivered nowhere, or a behavior it could not drive to its end state (file "", lineStart 0, lineEnd 0 — do NOT invent an anchor for code that does not exist), in-diff for everything else.',
    'Each finding carries: file + lineStart/lineEnd anchoring it, a one-line description, the repo-wide flag where the reviewer raised it (carry its grep evidence), and the cited source as three prose fields — its title, a one-line gist of what it requires, and the quoted sentence the finding turns on — plus its ID as a handle.',
    PRIOR_ROUNDS.length
      ? 'Dedup against this change\'s earlier review rounds, below. A finding a prior round refuted, filed as an issue, or settled by an answer the code now honors is already decided → dedup=already-adjudicated, dedupRef=the prior ID and outcome. A finding a prior round sent back for fixing that the code at this head still shows → dedup=still-open-from-prior, dedupRef=the prior ID (it stays in: the fix did not land). An uncertain match → possibly-duplicates (stays in).\n' + PRIOR_ROUNDS.join('\n---\n')
      : 'This is the change\'s first review round — no prior rounds to dedup against.',
    'Then list the open review-finding issues yourself (' + WF_CMD + ' issue list --label review-finding --state open; ' + WF_CMD + ' issue show <n> for one\'s body) and dedup against them conservatively, at the rule or pattern level: a subject that predates this diff and matches one → dedup=already-ticketed, dedupRef=#N; one this diff introduces that matches a filed pattern → dedup=instance-of-open, dedupRef=#N (stays in — new instances of a known pattern are new debt). A visible duplicate is recoverable; a silent suppression is not.',
  ])
}

function findingValidatorPrompt(axisName, findings) {
  return j([
    'You are a fresh adversarial validator in a wayfinder review round. You did not author these findings; your job is to try to REFUTE each one, on its own — no fix exists yet.',
    common(),
    AXIS_INPUTS,
    'Findings to validate (axis: ' + axisName + '):',
    JSON.stringify(findings.map(f => ({ id: f.id, kind: f.kind, file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd, description: f.description, repoWide: f.repoWide, citedSource: f.citedSource }))),
    'Per finding, answer one question: is the finding real? Read the cited source and the actual hunk — does the rule, Acceptance line, or decision say what the reviewer claims, does the code actually breach it, and does the claimed harm survive what the compiler and tooling already guarantee? verdict=finding-refuted (with the reason) or finding-validated.',
    axisName === 'Spec'
      ? 'A finding about evidence or a behavior the reviewer drove turns on what the app does: check the evidence the change body points at, and where that does not settle it, drive the behavior yourself through the verify skill. ' + DRIVE_SLOTS_RULE
      : null,
    BUILD_SLOTS_RULE,
    'Settle SCOPE first, before the merits, and return it as the scope field: introduced-by-diff (the hunk it anchors to is a line this diff added, changed, or removed), missing-requirement (an absence — something this piece was meant to deliver and did not), or pre-existing (the subject is code this diff never touched, however wrong it is). A pre-existing finding is refuted on scope no matter how real it is — check the anchor against the diff yourself rather than trusting the reviewer.',
    'A finding with kind=absence has no anchor by construction: its scope is missing-requirement if the thing really is delivered nowhere, and finding-refuted if you find it delivered — never pre-existing.',
    axisName === 'Spec'
      ? 'Also classify each finding: code-diverges or spec-suspect, decided by ONE test — would the owner\'s answer change the fix? spec-suspect ONLY when: (a) two or more defensible readings of the Acceptance or a decision call for different behaviour, (b) commit messages, tests, or a decision record on the piece show a deliberate deviation, or (c) the piece\'s own statements, its decisions, or the charter collide. Silence alone is NOT doubt: a defect with one defensible minimal fix — a visible bug, a wrong comment, dead code the diff itself added, evidence that does not show what it claims — is code-diverges even where nothing speaks to it. A binding earlier answer that directly governs a finding makes it code-diverges from that answer, never a re-ask. Where real behavioural doubt survives the test → spec-suspect: a false spec-suspect costs one agent\'s glance; a false code-diverges silently rewrites behaviour.'
      : 'specClassification is n/a on this axis.',
    axisName === 'Standards'
      ? 'You may set repoWideRaised on a finding whose pattern the reviewer missed — only with the grep and both counts (inside and outside the diff) in repoWideEvidence.'
      : null,
  ])
}

function proposerPrompt(axisName, survivors) {
  return j([
    'You are a ' + axisName + ' fix proposer of a wayfinder review round. Every finding below survived adversarial validation; the finding\'s reality is settled. Your proposals go to the piece\'s builder, which applies them in fix mode — draft them so a fresh agent can act on each without asking.',
    common(),
    AXIS_INPUTS,
    'Validated findings, each with its validator\'s reasoning:',
    JSON.stringify(survivors.map(f => ({ id: f.id, kind: f.kind, file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd, description: f.description, citedSource: f.citedSource, specClassification: f.specClassification, validatorReasoning: f.findingReason }))),
    'For each finding, propose the smallest concrete fix that resolves it: what to change, where — anchored as the fix field says — and a short sketch of the changed code — a sketch, not a full patch. A finding about evidence is fixed by re-proving the behavior and correcting the change body\'s line, or by fixing the code until the behavior proves. Size each fix: quick-fix (a few edits) or needs-a-session (a fresh context window\'s worth of work). Set docOnly=true only where the ENTIRE fix lives in comments, docs, or headers — no executable code changes. Fill cost before drafting: what breaks downstream if the finding simply stands. Keep each proposal under 100 words.',
    axisName === 'Spec' ? 'A spec-suspect finding gets a fix sketch per plausible reading where that is cheap — the answer will pick one.' : null,
  ])
}

function reproposerPrompt(axisName, items) {
  return j([
    'You are a fresh ' + axisName + ' fix proposer of a wayfinder review round. Each finding below is validated, and each carries a proposed fix that a fix validator rejected for an error in its own text — a wrong name, a misquote, an anchor at the wrong code — not for what it does. Redraft each fix once, with the validator\'s correction applied.',
    common(),
    AXIS_INPUTS,
    'Findings, each with its rejected proposal and the validator\'s correction:',
    JSON.stringify(items.map(f => ({ id: f.id, kind: f.kind, file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd, description: f.description, citedSource: f.citedSource, specClassification: f.specClassification, rejectedFix: f.proposal, rejectedSketch: f.sketch, correction: f.fixReason }))),
    'Check the correction against the code yourself, then return the same repair with its text made right — anchored by file plus a short quoted snippet, never a bare line number. Do not widen or rethink the repair. Size, docOnly, and cost as the fix fields say. Keep each proposal under 100 words.',
  ])
}

function fixValidatorPrompt(axisName, items, roster) {
  return j([
    'You are a fresh adversarial fix validator in a wayfinder review round — not the proposer, and not the finding validator. Your job is to try to REFUTE each fix.',
    common(),
    AXIS_INPUTS,
    'Proposals to validate (axis: ' + axisName + '; each with its finding and the finding-validator\'s reasoning):',
    JSON.stringify(items.map(f => ({ id: f.id, file: f.file, description: f.description, citedSource: f.citedSource, findingReasoning: f.findingReason, proposal: f.proposal, sketch: f.sketch, size: f.size, repoWide: f.repoWide, repoWideEvidence: f.repoWideEvidence, priorRejection: f.redraft ? f.redraft.rejection : undefined }))),
    'Every finding in this axis, for the edge fields below — dependsOn / invalidatedBy may name IDs outside your batch:',
    roster,
    'Per proposal, check: (1) does the fix actually resolve the finding? (2) is it proportionate — the minimal change that clears the finding, no speculative rewrites? (3) cross-axis: a fix for a Spec finding must not introduce a Standards violation, and a Standards fix must not change behaviour the piece\'s Acceptance or its decisions asked for. (4) re-settle the repo-wide flag: run the grep yourself, then drop every instance the cited rule does not actually govern — apply the rule\'s own scope and any grandfather clause (a rule binding only new-and-edited files never counts untouched files) — and fill instancesInDiff / instancesOutsideDiff with the GOVERNED counts only; the flag holds only when instancesOutsideDiff > 0. Your call on the flag is final downstream. (5) confirm or clear docOnly — final word: true only when the fix touches no executable code. A validated docOnly quick-fix on a spec-suspect finding goes back to the builder instead of becoming a question, so confirm it only when the code\'s current behaviour is right and only the record about it is wrong. (6) new rules: a fix that adds a prohibition, constraint, house rule, or new decision beyond the correction the finding forces is fix-rejected on that addition — say what to strip; new rules are the owner\'s to ask for.',
    'Verdict per proposal: validated, fix-rejected (with the reason), or needs-human (a genuine trade-off the owner must call). The finding\'s reality is NOT on the table — that was settled upstream; record any lingering doubt inside a fix-rejected reason.',
    'On fix-rejected, set rejectKind. text: the repair is right but its own text is wrong — a name or path that does not exist, a misquoted snippet, an anchor that points at the wrong code, or a check-(6) addition whose forced correction stands without it — and your reason states the correction (the right name, the exact quote, the right anchor, what to strip). substance: the repair itself is wrong — it does not resolve the finding, is disproportionate, breaks the other axis, is incoherent without its added rule, or rests on a premise you doubt. When unsure, substance. A proposal carrying priorRejection is a redraft of one rejected for its text — judge the redraft on its own merits.',
    'Fill the edge fields instead of burying edges in prose: dependsOn = IDs whose fixes must land for this one to work; invalidatedBy = IDs whose accepted fix makes this proposal\'s premise or wording false.',
  ])
}

function pairPrompt(a, b) {
  return j([
    'Two findings from different axes of a wayfinder review round anchor to the same code — usually one defect wearing two labels — and each carries a fix proposal that survived adversarial validation. Decide whether the two fixes AGREE (compatible or identical in effect — both can land, or one subsumes the other) or COMPETE (they cannot both land).',
    common(),
    AXIS_INPUTS,
    'The pair:',
    JSON.stringify([a, b].map(f => ({ id: f.id, file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd, description: f.description, citedSource: f.citedSource, proposal: f.proposal, sketch: f.sketch }))),
  ])
}

// Option shapes per question class — local to this gate, per /finding-pipeline.
const OPTION_SHAPES = [
  '- spec-unclear: the plausible readings of the Acceptance line or decision, each as what the builder would then build, plus "the code is right as written".',
  '- competing-fixes: one question for the pair — which behaviour wins; the answer settles both IDs.',
  '- genuine-trade-off: the trade-off\'s horns, consequences stated.',
  '- no-working-fix: send it back to the builder for a fresh attempt with the rejection attached, or leave it (recorded, with the reason).',
  '- unvalidated (its validator never returned, so its reality is unsettled): fix it as proposed, or drop it as not a real defect.',
].join('\n')

function assemblerPrompt(escalations) {
  return j([
    'You are the question assembler of a wayfinder review round — a fresh agent holding nothing but the structured findings below. Load /finding-pipeline and write one question block per escalation in the block shape its Question mechanics gives, then load /hitl-questions and hold every block to its cold-reader rules: someone who has never seen the piece, the diff, or this run must be able to pick an option from the block alone. A decider agent answers these on the human\'s behalf per /deciding, and the human reads them only if it escalates — write for either.',
    'The product area is ' + PIECE.title + ' (piece #' + PIECE.number + '), built in ' + CHANGE.title + ' (change ' + CHANGE.number + '). Number the blocks 1 of ' + escalations.length + ' onward, Spec-axis questions first. Anything you cannot explain from the fields you hold, expand from the cited source text the finding carries. The stakes line is the finding\'s cost field. A finding in another\'s joined list rides that block as one line of context, never its own block.',
    'Options per question class (the class is routing vocabulary — it never appears inside a block):',
    OPTION_SHAPES,
    'The escalations:',
    JSON.stringify(escalations),
    'Return one entry per escalation, keyed by its finding ID.',
  ])
}

function postPrompt(body, repoWide) {
  return j([
    'You are the post agent of a wayfinder review round — tracker mechanics only, no review. Work from the main checkout ' + REPO_ROOT + '. ' + FORGE_RULE + ' Do the steps in this order.',
    repoWide.length
      ? '1. File one standalone issue per repo-wide finding below (' + WF_CMD + ' issue create with no --parent, so it is never a piece of the plan; no Plan: line) — labelled review-finding and needs-triage. Title it by the pattern in plain words. Body: the pattern and the rule it breaks (title, gist, quoted sentence), the grep and its governed counts inside and outside the diff, the validated proposal, and where it was found: ' + changeRef(CHANGE) + ' for ' + ref(PIECE) + ' in ' + ref(PLAN) + '. Say it does not block that CHANGE. Findings:\n' + JSON.stringify(repoWide)
      : '1. No repo-wide findings this round — file nothing.',
    '2. Post the round comment below on change ' + CHANGE.number + ' (' + WF_CMD + ' change comment ' + CHANGE.number + ' --body-file <file>), verbatim, after replacing each {{issue:<ID>}} with the filed issue\'s title followed by its number, as Title (#N). If the change already has a comment opening with <!-- wayfinder review ' + ROUND + ' --> (a dead run of this round), replace that comment with this body (--edit <its id>) instead of adding another.',
    '3. Post the reviewer statuses on ' + HEAD_SHA + ' with ' + WF_CMD + ' status set <sha> <context> <state> "<description>", exactly these two:\n' + statusLines().map(s => '- ' + s.context + ' ' + s.state + ' "' + s.description + '"').join('\n'),
    '4. Remove the review worktree: git worktree remove --force ' + WORKTREE + '.',
    'posted is true only when step 2 and both statuses of step 3 succeeded.',
    'The round comment:\n' + body,
  ])
}

// ── Locate ───────────────────────────────────────────────────────────────────

phase('Locate')
const loc = await agent(locatePrompt(), { ...tier('executor'), schema: LOCATE_SCHEMA, effort: 'low', label: 'locate:change-' + CHANGE.number, phase: 'Locate' })
// No worktree or no merge-base means nothing can be reviewed: fail the run, so the lead relaunches it.
if (!loc || !loc.ok || !loc.base) throw new Error('review of change ' + CHANGE.number + ' could not locate its diff: ' + (loc ? loc.problem : 'locate agent died'))
BASE = loc.base
if (!loc.headIsCurrent) log('change ' + CHANGE.number + ' has moved past ' + HEAD_SHA + '; this round reviews ' + HEAD_SHA + ' and posts its statuses there')
log('change ' + CHANGE.number + ' round ' + ROUND + ': ' + loc.files.length + ' changed files over ' + BASE.slice(0, 8) + '...' + HEAD_SHA.slice(0, 8))

// ── The pipeline per axis ────────────────────────────────────────────────────

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// Fold a proposer's return onto its findings. A missing proposal defaults to a
// session-sized placeholder — except on a redraft (keepOnMissing), where the rejected
// proposal stands. Returns the findings that got a proposal.
function takeProposals(items, props, keepOnMissing) {
  const byId = new Map(((props && props.proposals) || []).map(p => [p.id, p]))
  const got = []
  for (const f of items) {
    const p = byId.get(f.id)
    if (p) got.push(f)
    if (!p && keepOnMissing) continue
    f.proposal = p ? p.fix : 'proposal missing'
    f.sketch = p ? p.sketch : ''
    f.size = p ? p.size : 'needs-a-session'
    f.docOnly = p ? !!p.docOnly : false
    f.cost = p ? p.cost : 'unknown — proposer result missing'
  }
  return got
}

// Fold a fix validator's return onto its findings. A missing verdict fails toward less
// action: needs-human on a first validation, fix-rejected (missingVerdict) on a redraft's.
function takeFixVerdicts(items, r, missingVerdict) {
  const fvs = new Map(((r && r.verdicts) || []).map(v => [v.id, v]))
  for (const f of items) {
    const v = fvs.get(f.id)
    f.fixVerdictMissing = !v
    f.fixVerdict = v ? v.verdict : (missingVerdict || 'needs-human')
    f.fixReason = v ? v.reason : (f.redraft ? f.redraft.rejection + ' (redraft never validated — fix-validator result missing)' : 'fix-validator result missing')
    // A rejection with no kind is substance — only a named text error earns a redraft.
    f.rejectKind = v && v.verdict === 'fix-rejected' ? (v.rejectKind === 'text' ? 'text' : 'substance') : null
    // This stage has the last word on repo-wide and docOnly — routing reads both from here.
    if (v) {
      f.docOnly = !!v.docOnly
      f.repoWide = v.repoWide && v.instancesOutsideDiff > 0
      f.instancesInDiff = v.instancesInDiff
      f.instancesOutsideDiff = v.instancesOutsideDiff
    }
    f.dependsOn = v ? v.dependsOn : []
    f.invalidatedBy = v ? v.invalidatedBy : []
  }
}

const SHELVED = new Set(['already-adjudicated', 'already-ticketed'])

// One axis: chunks of findings flow through validate → propose → validate-fix as
// independent pipeline chains, no cross-chunk barriers.
async function runAxis(axisName, labeled) {
  const shelved = labeled.filter(f => SHELVED.has(f.dedup))
  const inQueue = labeled.filter(f => !SHELVED.has(f.dedup))
  const roster = inQueue.map(f => f.id + ' — ' + f.file + ': ' + f.description).join('\n')

  await pipeline(chunk(inQueue, CHUNK_SIZE),
    async (c, _, i) => {
      const r = await agent(findingValidatorPrompt(axisName, c),
        { ...tier('decider'), schema: FINDING_VERDICTS_SCHEMA, phase: 'Validate findings', label: 'validate:' + axisName + ':' + (i + 1) })
      const verdicts = new Map(((r && r.verdicts) || []).map(v => [v.id, v]))
      for (const f of c) {
        const v = verdicts.get(f.id)
        // A validator that died keeps its finding, flagged unvalidated so routing
        // sends it to an answerer instead of straight back to the builder.
        f.unvalidated = !v
        f.findingVerdict = v ? v.verdict : 'finding-validated'
        f.findingReason = v ? v.reason : 'validator result missing — kept unvalidated'
        f.specClassification = v ? v.specClassification : 'n/a'
        // Scope is settled by the script, not the prompt: a finding anchored to code
        // the diff never touched leaves here, however real it is.
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
      takeProposals(survivors, props)
      return survivors
    },
    async (survivors, _, i) => {
      if (!survivors.length) return survivors
      const r = await agent(fixValidatorPrompt(axisName, survivors, roster),
        { ...tier('decider'), schema: FIX_VERDICTS_SCHEMA, phase: 'Validate fixes', label: 'validate-fix:' + axisName + ':' + (i + 1) })
      takeFixVerdicts(survivors, r)

      // A repair rejected for its own text gets one redraft with the correction attached,
      // then a fresh fix validator; a second rejection of any kind is no working fix.
      const redraft = survivors.filter(f => f.fixVerdict === 'fix-rejected' && f.rejectKind === 'text')
      if (!redraft.length) return survivors
      for (const f of redraft) f.redraft = { rejection: f.fixReason, outcome: 'pending' }
      const props = await agent(reproposerPrompt(axisName, redraft),
        { ...tier('decider'), schema: PROPOSALS_SCHEMA, phase: 'Propose', label: 'repropose:' + axisName + ':' + (i + 1) })
      const redrafted = takeProposals(redraft, props, true)
      // A redraft that never came back leaves its rejection standing — no working fix.
      for (const f of redraft) {
        if (!redrafted.includes(f)) { f.redraft.outcome = 'reproposer-died'; f.fixReason = f.redraft.rejection + ' (redraft never returned)'; f.rejectKind = 'substance' }
      }
      if (!redrafted.length) return survivors
      const r2 = await agent(fixValidatorPrompt(axisName, redrafted, roster),
        { ...tier('decider'), schema: FIX_VERDICTS_SCHEMA, phase: 'Validate fixes', label: 'revalidate-fix:' + axisName + ':' + (i + 1) })
      takeFixVerdicts(redrafted, r2, 'fix-rejected')
      for (const f of redrafted) {
        f.redraft.outcome = f.fixVerdictMissing ? 'revalidator-died' : f.fixVerdict
        if (f.fixVerdict === 'fix-rejected') f.rejectKind = 'substance' // the one redraft is spent
      }
      return survivors
    })

  const survivors = inQueue.filter(f => f.findingVerdict === 'finding-validated')
  const refuted = inQueue.filter(f => f.findingVerdict === 'finding-refuted')
  log(axisName + ': ' + labeled.length + ' findings — ' + survivors.length + ' validated, ' + refuted.length + ' refuted, ' + shelved.length + ' shelved by dedup')
  return { survivors, refuted, shelved }
}

// A dead reviewer or labeler would let the change pass unreviewed, so either one fails the
// run instead, and the lead relaunches it.
async function specAxis() {
  const review = await agent(specReviewerPrompt(), { ...tier('decider'), schema: SPEC_REVIEW_SCHEMA, phase: 'Review', label: 'review:spec' })
  if (!review) throw new Error('spec reviewer of change ' + CHANGE.number + ' returned nothing')
  const drives = review.drove.map(d => '- ' + d.behavior + ' — ' + d.how + ' — saw: ' + d.observed + (d.holds ? '' : ' — DOES NOT HOLD')).join('\n')
  const report = review.report + '\n\nBehaviors re-driven at ' + HEAD_SHA + ':\n' + drives
  const labeled = await agent(labelPrompt('SPEC', 'Spec', [report]), { ...tier('decider'), schema: FINDINGS_SCHEMA, phase: 'Label', label: 'label:spec' })
  if (!labeled) throw new Error('spec labeler of change ' + CHANGE.number + ' returned nothing')
  return { drove: review.drove, ...(await runAxis('Spec', labeled.findings)) }
}

async function standardsAxis() {
  if (STANDARDS_IDLE) {
    log('No documented standards — standards axis idle')
    return { idle: true, survivors: [], refuted: [], shelved: [] }
  }
  const report = await agent(standardsReviewerPrompt(), { ...tier('decider'), phase: 'Review', label: 'review:standards' })
  if (!report) throw new Error('standards reviewer of change ' + CHANGE.number + ' returned nothing')
  const labeled = await agent(labelPrompt('STD', 'Standards', [report]), { ...tier('decider'), schema: FINDINGS_SCHEMA, phase: 'Label', label: 'label:standards' })
  if (!labeled) throw new Error('standards labeler of change ' + CHANGE.number + ' returned nothing')
  return { idle: false, ...(await runAxis('Standards', labeled.findings)) }
}

phase('Review')
const [spec, std] = await parallel([() => specAxis(), () => standardsAxis()])
if (!spec || !std) throw new Error('a review axis of change ' + CHANGE.number + ' did not finish')

// Cross-axis pairs: same file, overlapping lines — one defect wearing two labels.
const pairList = []
for (const s of std.survivors) {
  for (const p of spec.survivors) {
    if (s.file && s.file === p.file && s.lineStart <= p.lineEnd && p.lineStart <= s.lineEnd) {
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
    // A dead pair agent makes the pair a question — conservative, and visible.
    a.pairResolution = b.pairResolution = r ? r.resolution : 'competing'
    a.pairReason = b.pairReason = r ? r.reason : 'pair-resolution agent died'
  })
}

// ── Route — plain script logic, no agent decides this ────────────────────────
// changes → the piece's build in fix mode; question → answered first, then fix mode;
// issue → a standalone repo-wide issue that never blocks this CHANGE.

phase('Route')
const all = spec.survivors.concat(std.survivors)
const byId = new Map(all.map(f => [f.id, f]))
const axisOf = f => (f.id.includes('-STD-') ? 'standards' : 'spec')

for (const f of all) {
  // A validated doc-only quick-fix on a spec-suspect finding goes back to the builder:
  // the code's behaviour was deemed right, only the record was wrong.
  const docOnlyResolved = f.fixVerdict === 'validated' && f.size === 'quick-fix' && f.docOnly
  if (f.unvalidated) { f.route = 'question'; f.questionClass = 'unvalidated' }
  else if (f.repoWide) { f.route = 'issue' }
  else if (f.specClassification === 'spec-suspect' && !docOnlyResolved) { f.route = 'question'; f.questionClass = 'spec-unclear' }
  else if (f.crossAxisPair && f.pairResolution === 'competing') { f.route = 'question'; f.questionClass = 'competing-fixes' }
  else if (f.fixVerdict === 'needs-human') { f.route = 'question'; f.questionClass = 'genuine-trade-off' }
  else if (f.fixVerdict === 'fix-rejected') { f.route = 'question'; f.questionClass = 'no-working-fix' }
  else { f.route = 'changes' }
}

// Edges and pairs route together: a fix waiting on a question joins that question.
let settledRoutes = false
while (!settledRoutes) {
  settledRoutes = true
  for (const f of all) {
    if (f.route !== 'changes') continue
    const partners = (f.dependsOn || []).concat(f.crossAxisPair ? [f.crossAxisPair] : []).concat(f.invalidatedBy || [])
    const target = partners.map(id => byId.get(id)).find(t => t && t.route === 'question')
    if (target) {
      f.route = 'question'
      f.questionClass = 'joined'
      f.joinedTo = target.joinedTo || target.id
      settledRoutes = false
    }
  }
}
for (const f of all) {
  if (f.route !== 'changes') continue
  f.staleAfter = (f.invalidatedBy || []).filter(id => byId.get(id) && byId.get(id).route === 'changes')
  const partner = f.crossAxisPair && byId.get(f.crossAxisPair)
  if (partner && partner.route === 'changes' && f.pairResolution === 'agreeing') f.pairWith = partner.id
}

// What fix mode needs to act on a finding without the review's context.
const brief = f => ({
  id: f.id, axis: axisOf(f), kind: f.kind, file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd,
  description: f.description, citedSource: f.citedSource,
  proposal: f.proposal, sketch: f.sketch, size: f.size, docOnly: !!f.docOnly,
  dependsOn: f.dependsOn || [], staleAfter: f.staleAfter || [], pairWith: f.pairWith || null,
  fromPrior: f.dedup === 'still-open-from-prior' ? f.dedupRef : null,
})

const changes = all.filter(f => f.route === 'changes').map(brief)
const heads = all.filter(f => f.route === 'question' && f.questionClass !== 'joined')
  .sort((a, b) => (axisOf(a) === axisOf(b) ? 0 : axisOf(a) === 'spec' ? -1 : 1))
const joinedTo = id => all.filter(f => f.questionClass === 'joined' && f.joinedTo === id)
const repoWide = all.filter(f => f.route === 'issue')

const escalations = heads.map(f => ({
  id: f.id, axis: axisOf(f), questionClass: f.questionClass, kind: f.kind,
  file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd,
  description: f.description, citedSource: f.citedSource, cost: f.cost,
  specClassification: f.specClassification, findingReason: f.findingReason,
  proposal: f.proposal, sketch: f.sketch, size: f.size,
  fixVerdict: f.fixVerdict, fixReason: f.fixReason, redraft: f.redraft || null,
  crossAxisPair: f.crossAxisPair ? brief(byId.get(f.crossAxisPair)) : null, pairReason: f.pairReason || null,
  joined: joinedTo(f.id).map(g => ({ id: g.id, description: g.description, proposal: g.proposal })),
}))

// Question blocks from a fresh assembler. A dead assembler leaves a plain block built
// from the fields, so every question still reaches an answerer.
let blocks = new Map()
if (escalations.length) {
  const a = await agent(assemblerPrompt(escalations), { ...tier('decider'), schema: BLOCKS_SCHEMA, phase: 'Route', label: 'assemble:questions' })
  blocks = new Map(((a && a.blocks) || []).map(b => [b.id, b.block]))
}
const fallbackBlock = (e, i) => md([
  '### ' + e.description + ' — ' + (i + 1) + ' of ' + escalations.length + ' (' + e.id + ')', '',
  '> ' + e.citedSource.quote + ' — ' + e.citedSource.title, '',
  'Proposed fix: ' + e.proposal, '',
  'Why it is a question: ' + e.questionClass + ' — ' + (e.fixReason || e.findingReason),
])
const questions = escalations.map((e, i) => ({
  id: e.id,
  settles: [e.id].concat(e.joined.map(g => g.id)),
  block: blocks.get(e.id) || fallbackBlock(e, i),
  findings: [brief(byId.get(e.id))].concat(joinedTo(e.id).map(brief)),
}))

const verdict = questions.length ? 'questions' : changes.length ? 'changes' : 'pass'

// ── Post ─────────────────────────────────────────────────────────────────────

// An axis passes only when none of its findings went back or became a question.
function statusLines() {
  const blocking = axis => all.filter(f => axisOf(f) === axis && (f.route === 'changes' || f.route === 'question')).length
  const line = (axis, context, idle) => {
    if (idle) return { context, state: 'success', description: 'standards axis idle' }
    const n = blocking(axis)
    return n
      ? { context, state: 'failure', description: 'review round ' + ROUND + ': ' + n + ' ' + axis + ' finding' + (n > 1 ? 's' : '') + ' sent back or questioned' }
      : { context, state: 'success', description: 'review round ' + ROUND + ': no ' + axis + ' finding stands' }
  }
  return [line('spec', 'wayfinder/spec', false), line('standards', 'wayfinder/standards', std.idle)]
}

function outcome(f) {
  if (f.route === 'changes') return '**sent back** — ' + f.proposal + (f.pairWith ? ' (one fix with ' + f.pairWith + ')' : '')
  if (f.route === 'question') return '**question** — ' + (f.questionClass === 'joined' ? 'rides ' + f.joinedTo + '\'s question' : 'below')
  if (f.route === 'issue') return '**filed** — {{issue:' + f.id + '}} (repo-wide; does not block this change)'
  return ''
}
const anchor = f => (f.kind === 'absence' ? 'absent' : '`' + f.file + ':' + f.lineStart + (f.lineEnd !== f.lineStart ? '-' + f.lineEnd : '') + '`')
const findingLine = f => '- ' + f.id + ' — ' + f.description + ' (' + anchor(f) + ') — ' + outcome(f)
const refutedLine = f => '- ' + f.id + ' — ' + f.description + ' — refuted: ' + f.findingReason
const shelvedLine = f => '- ' + f.id + ' — ' + f.description + ' — already settled: ' + f.dedupRef
const axisSection = (name, ax) => md([
  '### ' + name,
  ax.idle ? 'Idle — no documented standards govern these files.' : null,
  !ax.idle && !ax.survivors.length && !ax.refuted.length && !ax.shelved.length ? 'No findings.' : null,
  ...ax.survivors.map(findingLine), ...ax.refuted.map(refutedLine), ...ax.shelved.map(shelvedLine),
])

const body = md([
  '<!-- wayfinder review ' + ROUND + ' -->',
  '## Review round ' + ROUND + ' — ' + verdict,
  'Reviewed ' + changeRef(CHANGE) + ' for ' + ref(PIECE) + ' at `' + HEAD_SHA + '` (diff from merge-base `' + BASE + '` with ' + EFFORT_BRANCH + '). ' +
    changes.length + ' finding' + (changes.length === 1 ? '' : 's') + ' sent back, ' + questions.length + ' question' + (questions.length === 1 ? '' : 's') + ', ' + repoWide.length + ' filed as repo-wide.',
  '',
  '### Re-driven at this head',
  ...spec.drove.map(d => '- ' + d.behavior + ' — ' + (d.holds ? 'holds' : '**does not hold**') + ': ' + d.observed),
  '',
  axisSection('Spec', spec), '',
  axisSection('Standards', std),
  questions.length ? '\n### Questions\n\n' + questions.map(q => q.block).join('\n\n') : null,
])

phase('Post')
const post = await agent(postPrompt(body, repoWide.map(f => ({
  id: f.id, description: f.description, citedSource: f.citedSource, repoWideEvidence: f.repoWideEvidence,
  instancesInDiff: f.instancesInDiff || 0, instancesOutsideDiff: f.instancesOutsideDiff || 0, proposal: f.proposal, sketch: f.sketch,
}))), { ...tier('executor'), schema: POST_SCHEMA, phase: 'Post', label: 'post:round-' + ROUND })
// Unposted statuses leave the change unlandable and the round unrecorded: fail, so the lead relaunches.
if (!post || !post.posted) throw new Error('review round ' + ROUND + ' of change ' + CHANGE.number + ' was not posted: ' + (post ? post.problem : 'post agent died'))

log('change ' + CHANGE.number + ' round ' + ROUND + ': ' + verdict + ' — ' + changes.length + ' sent back, ' + questions.length + ' questions, ' + post.issues.length + ' repo-wide issues filed')
return { status: verdict, verdict, round: ROUND, changes, questions }
