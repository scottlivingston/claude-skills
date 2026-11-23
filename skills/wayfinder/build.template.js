export const meta = {
  name: 'wayfinder-build',
  description: 'Build one wayfinder piece: locate its worktree, branch and change → build plan → build (or fix review findings) → prove its behaviors through the verify skill → open the change → wait for CI and fix red in place → green, or park',
  phases: [
    { title: 'Locate', detail: 'executor-tier: create or reuse the worktree and piece branch, report what already exists' },
    { title: 'Plan', detail: 'decider-tier: the build plan, from the code as it stands, posted on the piece (build mode only)' },
    { title: 'Build', detail: 'decider-tier: build, or in fix mode apply the review findings, in the worktree; committed as it goes' },
    { title: 'Prove', detail: 'executor-tier: drive every Acceptance line through the verify skill, capture evidence, update the feature map; one rework round' },
    { title: 'Open change', detail: 'executor-tier: post decision records and friction notes, write the change body, open or update the change' },
    { title: 'CI', detail: 'executor-tier waits on the gate\'s CI; decider-tier fixes red, at most two attempts' },
    { title: 'Park', detail: 'executor-tier: hold the piece, post what is missing, remove the worktree' },
  ],
}

// Template for the /wayfinder build workflow: one piece, in one worktree, from
// its branch to a green change proposed for the effort branch — or a park with
// exactly what
// is missing. Build mode builds the piece; fix mode applies a review round's
// findings and answers — or resolves a conflict with the effort branch — on the
// piece's open change. This file owns every stage's
// prompt; SKILL.md says what the Build stage is for and LEAD.md says how the
// lead launches it and acts on its return. The lead holds the piece's
// claim (it is the piece's assignee) for the whole run; this workflow never takes or releases it.
// A dead agent throws, so the run fails and the lead's relaunch picks up from
// what the worktree, branch and change already hold.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes): JSON.stringify or
// Python's json.dumps, spliced in with a plain string replace — a regex
// replacement string turns the \n escapes back into raw newlines and the script
// no longer parses. Nothing goes through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const PLAN_REF = FILL      // the plan issue, as "#<n>"
const PIECE = FILL         // { number: <n>, title: "<issue title>", body: "<issue body verbatim>" }
const DECISIONS = FILL     // every decision issue under the piece's Builds on: [{ ref: "#<n>", title, body: "<issue body verbatim>" }] — [] when none
const CHARTER_PATH = FILL  // the plan body's Charter: line, e.g. "docs/wayfinder/<slug>.md"
const SLUG = FILL          // the effort's slug
const EFFORT_BRANCH = FILL // "effort/<slug>"
const PIECE_BRANCH = FILL  // "piece/<slug>/<piece number>"
const WORKTREE = FILL      // absolute path: <REPO_ROOT>/.claude/worktrees/<slug>/piece-<piece number>
const REPO_ROOT = FILL     // absolute path of the repo's main checkout
const MODE = FILL          // "build" for a ready piece; "fix" when the lead is sending a review round back, or the gate reported the change in conflict with the effort branch
const FIX_INPUT = FILL     // fix mode: the review round number, its findings with their validated proposed repairs, and every answer to its questions, verbatim from the review's return and the answers posted; for a conflict, the failing sc/merge status's description — "" in build mode
const VERIFY_SKILL = FILL  // the verify skill's directory relative to the repo root, from the charter's Verified through line, e.g. ".claude/skills/verify-web" — "" when this piece is the one that builds it
const APP = FILL           // the <app> of verify-<app> — from VERIFY_SKILL, or, when this piece builds the skill, the app name its Goal or the charter names
const TEST_NOTES = FILL    // per /testing: the governing TESTING.md sections verbatim (Typecheck, Unit, Integration, Scoping to a change, Green — each with the scope it binds), or "" when the repo has none

const EXECUTOR_MODEL = FILL // per /model-policy: the executor tier's resolved model, or null to inherit
const DECIDER_MODEL = FILL  // per /model-policy: the decider tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the run genuinely deviates ═══════════

const TIER_MODEL = { executor: EXECUTOR_MODEL, decider: DECIDER_MODEL }
const tier = t => (TIER_MODEL[t] ? { model: TIER_MODEL[t] } : {})
const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')

const FIX = MODE === 'fix'
const N = PIECE.number
const BUILDS_SKILL = VERIFY_SKILL === ''
const SKILL_DIR = BUILDS_SKILL ? '.claude/skills/verify-' + APP : VERIFY_SKILL
const PROVE_ROUNDS = 2 // build → prove rounds in all
const CI_FIXES = 2     // fix attempts on red CI

// The B<n> lines of the piece's Acceptance — every one needs proof and a Behaviors line.
const ACCEPTANCE = (PIECE.body.split(/^## Acceptance\s*$/m)[1] || '').split(/^## /m)[0]
const BEHAVIOR_IDS = [...new Set((ACCEPTANCE.match(/^- (B\d+)/gm) || []).map(s => s.slice(2)))]
// A prover often returns a behavior's whole line ("B10: open a change…") where the schema asks for its ID.
const behaviorId = line => {
  const m = /^\s*(B\d+)(?![\w'])/.exec(line)
  return m && BEHAVIOR_IDS.includes(m[1]) ? m[1] : line
}

function need(result, what) {
  if (!result) throw new Error(what + ' died; relaunching resumes from the worktree, branch and change')
  return result
}

// Every worktree shares one repo with no remote, and only the gate moves the effort branch.
const GIT_RULE = 'There is no remote: never fetch or push — every worktree shares one repo, so a commit on a branch is visible to all at once. The code as it stands is the local branch ' + EFFORT_BRANCH + '. Never check that branch out (the gate\'s own checkout holds it), commit to it, or move it — a hook refuses. Read it with git show ' + EFFORT_BRANCH + ':<path> or git diff ' + EFFORT_BRANCH + '...<ref>.'

// The one sentence that introduces the forge to an agent that touches the tracker.
const FORGE_RULE = 'This effort has no GitHub: its tracker, changes and commit statuses live in sc, this machine\'s forge, reached only through the sc command (run sc --help, and sc <noun> <verb> --help, before first use; every read takes --json, and a body or comment is written to a file and passed as --body-file <file>). Never run gh. Labels are /issue-tracker\'s vocabulary. Run it from ' + REPO_ROOT + '.'

const CONTEXT = j([
  'You are one stage of the build workflow for one piece of a wayfinder effort: piece #' + N + ' "' + PIECE.title + '" of plan ' + PLAN_REF + '. The effort runs unattended. The human set its destination, acceptance behaviors, principles and design in the charter, ' + CHARTER_PATH + ' (read it in the worktree); agents make every call in between per /deciding.',
  'Work only in the worktree ' + WORKTREE + ', on branch ' + PIECE_BRANCH + '. Never edit files in ' + REPO_ROOT + '\'s own checkout or on another branch. ' + GIT_RULE,
  'The piece (issue #' + N + '), verbatim:',
  PIECE.body,
  DECISIONS.length
    ? 'The decisions it builds on, in full:\n' + DECISIONS.map(d => '### ' + d.ref + ' ' + d.title + '\n' + d.body).join('\n\n')
    : 'It builds on no decision issue.',
])

// Every build and test runs through sc's build pool, so the efforts and agents on
// one host never run more of them at once than the pool has slots.
// A workflow agent's turn ending is its final report, so it waits on a long run in the
// foreground, in bounded sc job wait calls, never on a completion notice.
const BUILD_SLOTS_RULE = 'Run every build and test command — compiles, test suites, anything from the test recipes — through the host\'s build pool: sc run --pool build -- <command>. It waits for a free slot, then runs the command and exits with its status. sc starts the command directly, with no shell, so wrap a pipeline or an && chain as sh -c "..."; exit 201 (the worktree changed while it waited) or 202 (the same command was queued again from this directory) means run it again; every agent and every CI job on this host shares that pool, so never run one outside it. Run it in the foreground with the Bash timeout at its 600000 ms maximum. One that can outlast that: queue it with sc run --detach --pool build -- <command>, which prints its job id and returns, then wait for it in the foreground with sc job wait <id> --timeout 9m, which exits with the command\'s own status, or 205 when the nine minutes ran out first; call it again until it exits anything but 205, and read the output with sc job logs <id>. Never end your turn to wait: your turn ending is your final report, and it stops the run. A run you have not seen finish has no result yet.'

// Every running copy of the app holds a drive slot, so the host never runs more copies than
// the verify skill says can live side by side.
const DRIVE_SLOTS_RULE = 'Run every copy of the app through the host\'s drive slots: start it with sc run --pool drive-' + APP + ' -- <the verify skill\'s launch command>, with run_in_background, so the slot is held for as long as that copy runs, and stop it per the skill\'s Cleanup when you are done. A copy started this way outlives the shell that started it: when it is still running after Cleanup, end it with sc job cancel <the job id sc run printed>. A launch command that returns while the app keeps running holds no slot: wrap a command that lasts the whole session instead. For an app with no long-running process, wrap each drive command the same way. Never drive a copy you did not start this way.'

const COMMENT_RULE = 'Per /implement: Comments and docs state what the code does now, for a reader who never saw the old version: never "no longer", "used to", "the old X", the replaced mechanism\'s name, or a ticket or decision ID. In the files you touch, rewrite any comment or doc that narrates a past change or has gone false. What changed belongs in the commit message.'

// /deciding's rules for a stage agent, in three parts: the plan and CI-fix stages take the
// first two, the builder all three.
// A load named deep in a long brief is skipped more often than not, so the build and CI-fix
// briefs open with theirs.
const loadFirst = (skills, why) => 'Before anything else, load ' + skills + ' with the Skill tool: ' + why + '.'
const DECIDE_RULE = 'Load /deciding. A detail the piece, its decisions and the charter leave open is yours to decide: decide it from the grounds /deciding orders and return the call in decisions — the workflow posts each as a decision record on the piece. A detail is never a reason to park.'
const PARK_RULE = 'Park instead — status=parked with exactly what is missing in reason — only when the piece cannot be built as written: it needs code another piece has not landed, or it conflicts with the charter\'s design or principles. A call that falls in one of /deciding\'s three escalation cases parks too, with the escalation drafted as /deciding says as the reason.'
const FRICTION_RULE = 'When your work has to bend around one of the decisions above, or finds evidence that one is wrong, return a friction note on it in friction and carry on with the decision as it stands.'

// /deciding's decision-record format, rendered from DECISION_ITEMS. /deciding owns the format;
// keep this in step with its "The decision record".
const GROUND_LABEL = { principle: 'Principle', design: 'Design', 'rests-on': 'Rests on', 'prior-art': 'Prior art', code: 'Code' }
function renderRecord(d) {
  return [
    '<!-- decision-record -->', '## Decision', '', d.decision, '', '## Grounds', '',
    ...d.grounds.map(g => '- **' + (GROUND_LABEL[g.kind] || g.kind) + ':** "' + g.quote + '" — ' + g.source), '',
    '## Rejected', '', ...(d.rejected.length ? d.rejected.map(r => '- ' + r) : ['- none']), '',
    '## Reversal', '', d.reversal,
  ].join('\n')
}

// /deciding's friction-note format.
function renderFriction(f) {
  return [
    '<!-- friction -->',
    '**From:** ' + f.from,
    '**Strain:** ' + f.strain,
    '**Evidence:** ' + f.evidence,
    '**Suggests:** ' + (f.suggests || 'nothing yet'),
  ].join('\n')
}

// ── Schemas ──────────────────────────────────────────────────────────────────

// One call an agent made that the piece, its decisions and the charter do not settle.
// Requiring quoted grounds means the agent must open the files it cites.
const DECISION_ITEMS = {
  type: 'array',
  description: 'every call you made that the piece, its decisions, the charter and the build plan do not settle; [] when you made none',
  items: {
    type: 'object', required: ['decision', 'grounds', 'rejected', 'reversal'],
    properties: {
      decision: { type: 'string', description: 'the call, stated so a spec can lift it' },
      grounds: {
        type: 'array', minItems: 1,
        items: {
          type: 'object', required: ['kind', 'quote', 'source'],
          properties: {
            kind: { enum: ['principle', 'design', 'rests-on', 'prior-art', 'code'] },
            quote: { type: 'string', description: 'the line it stands on, copied from the file or issue you opened in this run, never from this brief' },
            source: { type: 'string', description: 'the file path, charter section or issue the quote is from' },
          },
        },
      },
      rejected: { type: 'array', items: { type: 'string' }, description: 'each alternative, with the ground it lost on' },
      reversal: { type: 'string', description: '"two-way" or "one-way", then what undoing it would cost once built' },
    },
  },
}

const FRICTION_ITEMS = {
  type: 'array',
  description: 'one per decision above your work had to bend around or found evidence against; [] when none',
  items: {
    type: 'object', required: ['decision', 'from', 'strain', 'evidence', 'suggests'],
    properties: {
      decision: { type: 'string', description: 'the decision issue, as "#<n>"' },
      from: { type: 'string', description: 'what you were doing, e.g. "building piece #' + N + '"' },
      strain: { type: 'string', description: 'what had to bend, and how' },
      evidence: { type: 'string', description: 'quoted — the line, the failure, the source' },
      suggests: { type: 'string', description: 'what may be wrong with the decision, or ""' },
    },
  },
}

const LOCATE_SCHEMA = {
  type: 'object', required: ['ready', 'problem', 'commitsAhead', 'change', 'changeState', 'headSha', 'ci', 'conflict', 'buildPlan'],
  properties: {
    ready: { type: 'boolean', description: 'the worktree exists at the path, on the piece branch' },
    problem: { type: 'string', description: 'what stopped it when ready=false; "" otherwise' },
    commitsAhead: { type: 'integer', description: 'commits on the piece branch that the effort branch does not have' },
    change: { type: 'integer', description: 'the newest change for the piece that is open or landed; 0 when none' },
    changeState: { enum: ['open', 'landed', 'none'] },
    headSha: { type: 'string', description: 'the change\'s head sha; "" when no change' },
    ci: { enum: ['green', 'red', 'pending', 'none'], description: 'the ci/* statuses on the change\'s head; none when no change or no ci/* status yet' },
    conflict: { type: 'boolean', description: 'the open change\'s head carries a failing sc/merge status: the gate found it in conflict with the effort branch' },
    buildPlan: { type: 'string', description: 'the newest <!-- wayfinder build-plan --> comment on the piece, verbatim; "" when none' },
  },
}

const PLAN_SCHEMA = {
  type: 'object', required: ['status', 'plan', 'reason', 'decisions'],
  properties: {
    status: { enum: ['planned', 'parked'] },
    plan: { type: 'string', description: 'the build plan as posted; "" when parked' },
    reason: { type: 'string', description: 'exactly what is missing when parked; "" otherwise' },
    decisions: DECISION_ITEMS,
  },
}

const BUILD_SCHEMA = {
  type: 'object', required: ['status', 'summary', 'deviations', 'notApplied', 'testRuns', 'reason', 'decisions', 'friction'],
  properties: {
    status: { enum: ['built', 'parked'] },
    summary: { type: 'string', description: 'one paragraph: what the piece now delivers' },
    deviations: { type: 'array', items: { type: 'string' }, description: 'each place the work departed from the build plan, and why' },
    notApplied: {
      type: 'array', description: 'fix mode: each finding you did not apply as proposed, with why; [] otherwise',
      items: { type: 'object', required: ['finding', 'reason'], properties: { finding: { type: 'string' }, reason: { type: 'string' } } },
    },
    testRuns: {
      type: 'array', description: 'every test invocation you ran last, with the line it printed on finishing',
      items: { type: 'object', required: ['command', 'result'], properties: { command: { type: 'string' }, result: { type: 'string', description: 'the summary or exit line, copied — never "running" or a timeout' } } },
    },
    reason: { type: 'string', description: 'exactly what is missing when parked; "" otherwise' },
    decisions: DECISION_ITEMS,
    friction: FRICTION_ITEMS,
  },
}

const PROVE_SCHEMA = {
  type: 'object', required: ['harness', 'harnessClean', 'results', 'mapCommit', 'report'],
  properties: {
    harness: { type: 'string', description: 'what launch, doctor and cleanup did, each with what you saw; for a piece that builds the verify skill, whether its end-to-end run came out clean' },
    harnessClean: { type: 'boolean', description: 'launch, doctor and cleanup all worked' },
    results: {
      type: 'array', description: 'one per Acceptance line, in order',
      items: {
        type: 'object', required: ['line', 'proven', 'observed', 'evidence'],
        properties: {
          line: { type: 'string', description: 'the behavior ID (B<n>) for a behavior line, else the criterion verbatim' },
          proven: { type: 'boolean', description: 'you watched the end state the line names, this run' },
          observed: { type: 'string', description: 'what you did and what you saw; where it diverged when not proven' },
          evidence: { type: 'string', description: 'what was captured and where it lives; "" when nothing was' },
        },
      },
    },
    mapCommit: { type: 'string', description: 'the commit holding the feature-map changes; "" when none were needed' },
    report: { type: 'string', description: 'for a builder who must fix what did not prove: each failure, how to reproduce it, and what you saw' },
  },
}

const CHANGE_SCHEMA = {
  type: 'object', required: ['change', 'sha', 'problems'],
  properties: {
    change: { type: 'integer', description: 'the change number; 0 when none could be opened' },
    sha: { type: 'string', description: 'the change\'s head sha' },
    problems: { type: 'array', items: { type: 'string' }, description: 'what stopped the change; [] when it is open' },
  },
}

const CI_WAIT_SCHEMA = {
  type: 'object', required: ['result', 'sha', 'failing', 'problems'],
  properties: {
    result: { enum: ['green', 'red', 'none'], description: 'green when sc change wait exited 0, red when 1, none otherwise' },
    sha: { type: 'string' },
    failing: { type: 'array', items: { type: 'string' }, description: 'the failing statuses sc change wait printed: each ci/<job> that failed, or sc/merge' },
    problems: { type: 'array', items: { type: 'string' }, description: 'when the result is none: what the wait printed, or that it never finished' },
  },
}

const CI_FIX_SCHEMA = {
  type: 'object', required: ['status', 'summary', 'reason', 'decisions'],
  properties: {
    status: { enum: ['committed', 'rerun', 'parked'], description: 'committed = a fix commit is on the piece branch; rerun = the failure was outside the piece and you reran the failed jobs; parked = it cannot come green' },
    summary: { type: 'string', description: 'what failed and what you did' },
    reason: { type: 'string', description: 'exactly what is missing when parked; "" otherwise' },
    decisions: DECISION_ITEMS,
  },
}

const PARK_SCHEMA = {
  type: 'object', required: ['parked', 'note'],
  properties: {
    parked: { type: 'boolean', description: 'the hold is on and the park comment posted' },
    note: { type: 'string', description: 'anything that did not go through, e.g. a worktree that would not remove' },
  },
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function locatePrompt() {
  return j([
    'You are the locate stage of the build workflow for piece #' + N + ' "' + PIECE.title + '" of plan ' + PLAN_REF + ' — git and tracker mechanics, no code. Run every command from ' + REPO_ROOT + ' unless it says the worktree.',
    FORGE_RULE,
    GIT_RULE,
    'Make ' + WORKTREE + ' a worktree on branch ' + PIECE_BRANCH + ', reusing whatever already exists:',
    '- The worktree already exists on that branch → keep it, with any work in it. Commit nothing; uncommitted changes are an earlier run\'s and stay for the builder.',
    '- The branch exists but has no worktree → add the worktree on it (git worktree add ' + WORKTREE + ' ' + PIECE_BRANCH + ').',
    '- Another worktree holds the branch → it is a dead run\'s: remove it (its commits stay on the branch), then add the worktree at the path above.',
    '- The branch does not exist → ' + (FIX ? 'report the missing branch as the problem; fix mode needs the piece\'s existing branch.' : 'create it from the effort branch\'s current head with its worktree: git worktree add -b ' + PIECE_BRANCH + ' ' + WORKTREE + ' ' + EFFORT_BRANCH + '.'),
    'Then report:',
    '- commitsAhead: commits on ' + PIECE_BRANCH + ' that ' + EFFORT_BRANCH + ' does not have.',
    '- The newest change into ' + EFFORT_BRANCH + ' whose issue is ' + N + ' and whose state is open or landed (sc change list --issue ' + N + ' --target ' + EFFORT_BRANCH + ' --json); a closed change counts as none. For an open one (sc change view <change> --json): its head sha; the state of the ci/* statuses on that head (green when every one is pass, red when any is fail, pending when any is pending, none when there is none yet); and conflict — whether that head carries a failing sc/merge status.',
    '- The newest comment on issue #' + N + ' opening with <!-- wayfinder build-plan -->, verbatim, or "" (sc issue view ' + N + ').',
    'Leave the tracker, the labels and every other branch as you found them.',
  ])
}

function planPrompt() {
  return j([
    CONTEXT,
    'You write the piece\'s build plan. Read the code in the worktree — the effort branch\'s current head — and plan from the code as it stands now, not from the plan issue\'s picture of it. Write: where the work lands, the approach, the seams and files it touches, the tests TESTING.md calls for, and how each Acceptance line will be shown working through the verify skill (' + (BUILDS_SKILL ? 'which this piece builds, at ' + SKILL_DIR : SKILL_DIR) + '). One screen at most: the builder gets exactly this.',
    'Write no code and commit nothing. Post the plan as one comment on issue #' + N + ' whose first line is <!-- wayfinder build-plan --> (sc issue comment ' + N + ' --body-file <file>) and return it in plan. ' + FORGE_RULE,
    DECIDE_RULE + ' State each call in the plan too.',
    PARK_RULE + ' When you park, post no plan.',
  ])
}

function buildPrompt(plan, rework, conflict) {
  return j([
    CONTEXT,
    loadFirst('/deciding and /testing', 'you will make calls the piece leaves open and run its tests, and both are done per them'),
    FIX
      ? 'You fix the piece\'s open change — from a review round, or from a conflict the gate reported with the effort branch. Apply every finding below: its validated proposed repair is the default, adapted where the code has moved; every answer below is binding and settles the finding it names. A finding you cannot apply as proposed without breaking the piece or the charter goes in notApplied with why — the next review round judges it — never silently skipped.\n' + FIX_INPUT
      : 'You build the piece.',
    conflict ? 'The gate could not land the piece\'s change: its head conflicts with ' + EFFORT_BRANCH + ' (a failed sc/merge status). Merge ' + EFFORT_BRANCH + ' into ' + PIECE_BRANCH + ' in the worktree (git merge ' + EFFORT_BRANCH + ') and resolve every conflict so that both sides\' behavior holds — what already landed on the effort branch stays as it landed unless the piece\'s Acceptance requires otherwise. Never rebase and never touch ' + EFFORT_BRANCH + ' itself. Commit the merge; that new head is what CI and review judge next.' : null,
    plan ? 'The build plan:\n' + plan : null,
    rework ? 'The prover drove the piece through the verify skill and these did not prove. Fix them; the prover runs again after you:\n' + rework : null,
    'The branch may already hold commits or uncommitted changes from an earlier run that died: read them first and continue from them, never start over. Earlier calls named in those commit messages that are not yet decision records on issue #' + N + ' go in your decisions too.',
    'Tests follow the repo\'s TESTING.md: load /testing and resolve the recipes for the files you touch. There is no test-first rule — do not load /tdd. Before you return, run the unit invocations of the Scoping to a change rule applied to the files you touched, and report each run\'s finishing line in testRuns. Green means every run finished and you saw it pass; a test that fails and then passes on a rerun is red.',
    TEST_NOTES ? 'Test recipes (per /testing):\n' + TEST_NOTES : null,
    BUILD_SLOTS_RULE,
    'Starting the app to look at your own work is fine, through the drive slots. ' + DRIVE_SLOTS_RULE + ' Proving the Acceptance lines is the prover\'s job, after you.',
    BUILDS_SKILL ? 'This piece builds the verify skill for ' + APP + ', at ' + SKILL_DIR + ': load /create-verification-skill and build it per its steps 1–3, with the app taking its port and data directory from the environment so copies can run side by side, and run it end to end per its step 4 before you return. Its feature map gets one file per behavior in the charter, each headed by its B<n> and marked pending in its first line.' : null,
    COMMENT_RULE,
    DECIDE_RULE,
    PARK_RULE,
    FRICTION_RULE,
    'Commit as you go, each commit message naming any call it makes, after every meaningful step, so the work survives a crash. Never touch the tracker or a label; the workflow posts what you return. Leave the worktree clean and stop anything you started.',
  ])
}

function provePrompt() {
  return j([
    CONTEXT,
    'You are the prover. Drive every Acceptance line of the piece on the real app, from the code now on ' + PIECE_BRANCH + ' in the worktree, and capture evidence. You report; you never fix code. The only files you change are the feature map\'s.',
    BUILDS_SKILL
      ? 'This piece builds the verify skill itself, at ' + SKILL_DIR + ' in the worktree. Proving it means running that skill end to end per /create-verification-skill\'s step 4 (load it): launch, doctor, drive, capture evidence, clean up, with the evidence still at its named location afterwards — then driving every Acceptance line through it. What fails in the skill is reported, for the builder to fix.'
      : 'Load the verify skill at ' + SKILL_DIR + ' (read its SKILL.md in the worktree) and follow it: launch, doctor, then drive every Acceptance line through its Drive recipes, then clean up.',
    DRIVE_SLOTS_RULE,
    BUILD_SLOTS_RULE,
    'Proven means you watched, in this run, the end state the line names, reached the way the line says a user reaches it. A passing test, the code, or the builder\'s word proves nothing. A line you could not reach is not proven: say what blocked it. Capture the action and the resulting state, at the location the skill names, and say in evidence what was captured and where it lives.',
    'Then update the feature map under ' + SKILL_DIR + '/features/: each proven behavior\'s feature file loses the pending marker in its first line; a new user-facing behavior this piece created, beyond its Acceptance, gets a feature file of its own in the map\'s shape. Commit those changes alone; a feature file for a behavior that did not prove keeps its marker.',
    'Run the skill\'s Cleanup even when a drive fails, and leave nothing running.',
  ])
}

function changePrompt(built, proof, toPost) {
  const behaviorLines = proof.results.map(r => '- ' + r.line + ': ' + r.observed + ' — evidence: ' + r.evidence).join('\n')
  return j([
    'You are the change stage of the build workflow for piece #' + N + ' "' + PIECE.title + '" of plan ' + PLAN_REF + ' — tracker mechanics, no code. The piece\'s work is committed on ' + PIECE_BRANCH + '; the worktree is ' + WORKTREE + '. A change is that branch proposed for ' + EFFORT_BRANCH + '; the gate runs CI on its head and lands it once every required status passes, so there is nothing to merge yourself.',
    FORGE_RULE,
    toPost.length
      ? 'First post these, each as one comment, verbatim (sc issue comment <n> --body-file <file>), keeping each one\'s id, as sc issue view <n> --json lists it:\n' + toPost.map((p, i) => (i + 1) + '. On ' + p.where + (p.label ? ' (then add the label ' + p.label + ' to that issue)' : '') + ':\n' + p.body).join('\n\n')
      : null,
    'Write the change body in exactly this shape, which the reviewers read:',
    'Closes #' + N + '\n\n<one paragraph: what the piece delivers>\n\n## Behaviors\n- B<n>: <what was observed> — evidence: <what was captured and where it lives>\n\n## Decisions\n- <each call made, one line, naming its decision-record comment on the piece as "comment <id> on #' + N + '"; "none">\n\n## Deviations\n- <where the build departed from its build plan and why; "none">',
    'Fill it from these:',
    '- What it delivers: ' + built.summary,
    '- Behaviors (one line per Acceptance line, behavior IDs first; every B<n> needs its evidence):\n' + behaviorLines,
    '- Decisions: one line per decision record you posted above, naming its comment' + (FIX ? '; keep every Decisions and Deviations line already in the change body.' : '.'),
    '- Deviations:\n' + (built.deviations.concat(built.notApplied.map(x => 'review finding ' + x.finding + ' not applied as proposed: ' + x.reason)).map(d => '  - ' + d).join('\n') || '  - none'),
    FIX
      ? 'The change for ' + PIECE_BRANCH + ' is open (sc change list --state open --issue ' + N + ' --json shows it): replace its body with this one (sc change edit <change> --body-file <file>).'
      : 'Open the change: sc change open --branch ' + PIECE_BRANCH + ' --target ' + EFFORT_BRANCH + ' --issue ' + N + ' --title "' + PIECE.title + '" --body-file <file> — or, when one is already open for that branch, replace its body (sc change edit <change> --body-file <file>).',
  ])
}

function ciWaitPrompt(change, toPost, fixSummary) {
  return j([
    'You are the CI wait of the build workflow for piece #' + N + ' of plan ' + PLAN_REF + ' — tracker mechanics, no code. The gate runs the charter\'s CI jobs on the change\'s head as ci/<job> statuses; you only wait for them.',
    FORGE_RULE,
    toPost.length
      ? 'A CI fix just landed on change ' + change + '. First post these on issue #' + N + ', each as one comment, verbatim, then add one line per comment to the change body\'s ## Decisions section naming it as "comment <id> on #' + N + '", its id as sc issue view ' + N + ' --json lists it (sc change edit ' + change + ' --body-file <file>):\n' + toPost.map(p => p.body).join('\n\n---\n\n')
      : null,
    fixSummary ? 'Add one line to the change body\'s ## Deviations section (replacing a lone "none") saying what the CI fix changed: ' + fixSummary : null,
    'Then wait for the gate\'s CI on the change\'s head. sc change wait ' + change + ' --json blocks until every CI job has finished, which can take over an hour, so run it in the foreground as sc change wait ' + change + ' --json --timeout 9m: exit 205 means the nine minutes ran out with CI still running, so run it again, up to eight times. Never end your turn to wait: your turn ending is your final report. Report result from its exit status — 0 green, 1 red, anything else (205 after the eighth run included) none — with the head it printed as sha and, when red, every status it printed as fail in failing (sc/merge when that is what fails). When the result is none, put what it printed, or that it never finished, in problems. A wait you have not seen finish has no result yet.',
  ])
}

function ciFixPrompt(change, wait, attempt) {
  return j([
    CONTEXT,
    loadFirst('/deciding', 'you may make a call the fix leaves open, and it is made per it'),
    'You fix red CI on change ' + change + ' (attempt ' + attempt + ' of ' + CI_FIXES + '). Failing checks on ' + wait.sha + ': ' + wait.failing.join(', ') + '. Each ci/<job> is the job of that name in the head\'s sc.toml, run by the gate on that commit in a clean checkout. Read the log of each (sc change logs ' + change + ' <job>, run from ' + REPO_ROOT + '), find the cause, and fix it in the worktree. A failing sc/merge is not a job: the head conflicts with ' + EFFORT_BRANCH + ', so no CI ran — merge ' + EFFORT_BRANCH + ' into ' + PIECE_BRANCH + ' in the worktree (git merge ' + EFFORT_BRANCH + '; never rebase) and resolve every conflict so that both sides\' behavior holds. Reading logs and the rerun below are the only use of sc you make.',
    'When the failure is outside the piece and not caused by it — a network fetch that timed out, a host out of disk — rerun the failed jobs instead (sc change rerun ' + change + ') and return status=rerun. A check that is red because of the piece\'s code is fixed, never rerun.',
    'Reproduce it locally where you can and run the scoped tests for the files you touched before you commit. ' + BUILD_SLOTS_RULE,
    TEST_NOTES ? 'Test recipes (per /testing):\n' + TEST_NOTES : null,
    COMMENT_RULE,
    DECIDE_RULE,
    PARK_RULE,
    'Commit the fix on ' + PIECE_BRANCH + '; the gate runs CI on the new head. Never touch the tracker, a label or the change body; the workflow posts what you return.',
  ])
}

function parkPrompt(reason, changeNumber) {
  return j([
    'You are the park stage of the build workflow for piece #' + N + ' "' + PIECE.title + '" of plan ' + PLAN_REF + ' — tracker and git mechanics, no code. Run every command from ' + REPO_ROOT + '.',
    FORGE_RULE,
    'The piece cannot go on. What is missing:',
    reason,
    '1. Hold issue #' + N + ': sc issue hold ' + N + ' --reason "<what is missing, in one line>". The hold is what parks the piece: it shows held, and its change cannot land until the hold is released. Leave its assignee alone: that is the lead\'s claim, and the lead releases it.',
    '2. Post one comment on issue #' + N + ' whose first line is <!-- wayfinder park -->, then exactly what is missing as above, written so whoever fills the gap needs nothing else.',
    changeNumber ? '3. Change ' + changeNumber + ' is open: leave it open. It cannot land while the piece is held.' : null,
    'Then commit any uncommitted work in ' + WORKTREE + ' to ' + PIECE_BRANCH + ' as one commit titled "WIP at park", so nothing is lost, and remove the worktree (git worktree remove --force ' + WORKTREE + '). The branch stays.',
  ])
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function park(reason, changeNumber) {
  phase('Park')
  const r = need(await agent(parkPrompt(reason, changeNumber), { ...tier('executor'), schema: PARK_SCHEMA, label: 'park:#' + N, phase: 'Park' }), 'the park agent')
  log('Piece #' + N + ' parked: ' + reason.split('\n')[0] + (r.note ? ' (' + r.note + ')' : ''))
  return { status: 'parked', change: changeNumber || 0, sha: '', reason }
}

// The comments the change stage posts for agents that never touch the tracker.
function postings(decisions, friction) {
  return decisions.map(d => ({ where: 'issue #' + N, body: renderRecord(d) }))
    .concat(friction.map(f => ({ where: 'decision issue ' + f.decision, label: 'friction', body: renderFriction(f) })))
}

// CI: wait, fix red in place, wait again — at most CI_FIXES fix attempts.
async function landCi(change) {
  phase('CI')
  let toPost = []
  let fixSummary = ''
  for (let attempt = 0; ; attempt++) {
    const wait = need(await agent(ciWaitPrompt(change, toPost, fixSummary), { ...tier('executor'), schema: CI_WAIT_SCHEMA, label: 'ci-wait:change-' + change, phase: 'CI' }), 'the CI wait agent')
    toPost = []
    fixSummary = ''
    if (wait.result === 'green') return { status: 'green', change, sha: wait.sha, reason: '' }
    if (wait.result === 'none') return park('The gate\'s CI did not finish on change ' + change + ' (head ' + wait.sha + '): ' + (wait.problems.join('; ') || 'the wait for CI timed out') + '. Either the head\'s sc.toml lists no job or the sc daemon is not running its gate (sc gate list shows it).', change)
    if (attempt === CI_FIXES) return park('CI is still red on change ' + change + ' (head ' + wait.sha + ') after ' + CI_FIXES + ' fix attempts. Failing: ' + wait.failing.join(', '), change)
    const fix = need(await agent(ciFixPrompt(change, wait, attempt + 1), { ...tier('decider'), schema: CI_FIX_SCHEMA, label: 'ci-fix:change-' + change + ':' + (attempt + 1), phase: 'CI' }), 'the CI fix agent')
    if (fix.status === 'parked') return park(fix.reason, change)
    toPost = fix.decisions.map(d => ({ body: renderRecord(d) }))
    if (fix.status === 'committed') fixSummary = fix.summary
    log('CI fix ' + (attempt + 1) + ' on change ' + change + ': ' + fix.summary)
  }
}

// ── Locate ───────────────────────────────────────────────────────────────────

phase('Locate')
const loc = need(await agent(locatePrompt(), { ...tier('executor'), schema: LOCATE_SCHEMA, label: 'locate:#' + N, phase: 'Locate' }), 'the locate agent')
if (!loc.ready) return await park('The build workflow could not set up its worktree: ' + loc.problem, loc.changeState === 'open' ? loc.change : 0)
if (loc.changeState === 'landed') {
  log('Piece #' + N + ': change ' + loc.change + ' already landed')
  return { status: 'green', change: loc.change, sha: loc.headSha, reason: '' }
}
if (FIX && loc.changeState !== 'open') return await park('Fix mode found no open change for ' + PIECE_BRANCH + ' to apply its findings to.', 0)

// Build mode with its change already open: only CI is left.
if (!FIX && loc.changeState === 'open') {
  return await landCi(loc.change)
}

// ── Plan ─────────────────────────────────────────────────────────────────────

let planText = loc.buildPlan
const decisions = []
const friction = []
if (!FIX && !planText) {
  phase('Plan')
  const p = need(await agent(planPrompt(), { ...tier('decider'), schema: PLAN_SCHEMA, label: 'plan:#' + N, phase: 'Plan' }), 'the build-plan agent')
  if (p.status === 'parked') return await park(p.reason, 0)
  planText = p.plan
  decisions.push(...p.decisions)
}

// ── Build ⇄ Prove ────────────────────────────────────────────────────────────

let built = null
let proof = null
let rework = ''
for (let round = 1; round <= PROVE_ROUNDS; round++) {
  phase('Build')
  const b = need(await agent(buildPrompt(planText, rework, round === 1 && loc.conflict), { ...tier('decider'), schema: BUILD_SCHEMA, label: (FIX ? 'fix' : 'build') + ':#' + N + ':' + round, phase: 'Build' }), 'the builder')
  decisions.push(...b.decisions)
  friction.push(...b.friction)
  if (b.status === 'parked') return await park(b.reason, loc.changeState === 'open' ? loc.change : 0)
  built = built
    ? { ...b, deviations: built.deviations.concat(b.deviations), notApplied: built.notApplied.concat(b.notApplied) }
    : b

  phase('Prove')
  proof = need(await agent(provePrompt(), { ...tier('executor'), schema: PROVE_SCHEMA, label: 'prove:#' + N + ':' + round, phase: 'Prove' }), 'the prover')
  proof = { ...proof, results: proof.results.map(r => ({ ...r, line: behaviorId(r.line) })) }
  const reported = new Set(proof.results.map(r => r.line))
  const missing = BEHAVIOR_IDS.filter(id => !reported.has(id))
  const failed = proof.results.filter(r => !r.proven).map(r => r.line)
  if (proof.harnessClean && !missing.length && !failed.length) break
  rework = j([
    proof.harnessClean ? null : 'The verify harness did not run clean: ' + proof.harness,
    missing.length ? 'Not driven at all: ' + missing.join(', ') : null,
    failed.length ? 'Not proven: ' + failed.join(' | ') : null,
    proof.report,
  ])
  if (round === PROVE_ROUNDS) {
    return await park('After ' + PROVE_ROUNDS + ' build and prove rounds, the piece\'s behaviors still do not prove through the verify skill.\n' + rework, loc.changeState === 'open' ? loc.change : 0)
  }
}

// ── Open change ──────────────────────────────────────────────────────────────

phase('Open change')
const opened = need(await agent(changePrompt(built, proof, postings(decisions, friction)), { ...tier('executor'), schema: CHANGE_SCHEMA, label: 'change:#' + N, phase: 'Open change' }), 'the change agent')
if (!opened.change) return await park('The change could not be opened: ' + opened.problems.join('; '), 0)
return await landCi(opened.change)
