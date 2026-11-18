export const meta = {
  name: 'wayfinder-verify',
  description: 'Verify one pinned commit of a wayfinder effort branch: drive every built behavior through the verify skill → run the Green suite → post the Verify report, a defect piece per failure, and wayfinder/verify',
  phases: [
    { title: 'Drive', detail: 'executor-tier verifiers, one batch of built behaviors at a time, in the verify worktree at the pinned commit, holding a drive slot' },
    { title: 'Test', detail: 'one executor-tier agent runs the Green set per /testing through the build slots' },
    { title: 'Report', detail: 'one executor-tier agent files the defect pieces, posts the Verify report on the plan, and posts wayfinder/verify' },
  ],
}

// Template for a wayfinder Verify workflow: one pinned commit of the effort branch,
// every behavior a done piece covers driven on the real app through the effort's
// verify-<app> skill — already-proven ones included, since regressions come from
// new pieces — plus the repo's Green suite. Every failure becomes a defect piece
// for Steer. This file owns every verify agent's prompt; SKILL.md and LEAD.md say
// what the stage is for and what the lead does with the return.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes): JSON.stringify or
// Python's json.dumps, spliced in with a plain string replace — a regex
// replacement string turns the \n escapes back into raw newlines and the script
// no longer parses. Nothing goes through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const PLAN_REF = FILL        // the plan issue as "#<n>", e.g. "#12"
const SHA = FILL             // the full sha this run pins: the effort branch's head at fill time (the lead's pending wayfinder/verify sits on it)
const EFFORT_BRANCH = FILL   // the plan body's Effort branch: line, e.g. "effort/<slug>"
const REPO_ROOT = FILL       // absolute path of the main checkout of the repo
const WORKTREE = FILL        // absolute path of the verify worktree: <REPO_ROOT>/.claude/worktrees/<slug>/verify
const VERIFY_SKILL = FILL    // repo path of the verify-<app> skill: the one the charter's verification line names, or, for a greenfield charter, the .claude/skills/verify-* directory on the effort branch that the walking-skeleton piece built, e.g. ".claude/skills/verify-web"
const BEHAVIORS = FILL       // every charter behavior, in charter order: [{ id: "B1", text: "the charter's B1 line verbatim", built: true, pieces: [40, 41] }]
                             // built = a piece whose Acceptance carries the ID is done (wf.py pieces); pieces = every piece whose Acceptance carries it
const OPEN_DEFECTS = FILL    // the plan's open wayfinder:defect pieces: [{ number, title, behaviors: ["B3"], harness: false }] — behaviors = the B<n> IDs in its Acceptance; harness = it fixes the verify harness; [] if none
const FINAL = FILL           // true only for Close's last run on the commit the human will be asked to accept; false otherwise
const WF_CMD = FILL          // the effort's forge command: "<absolute path of the installed wayfinder skill's wf.py> --effort <slug>"
const SLOT_CMD = FILL        // absolute path of the installed wayfinder skill's slot.sh
const BUILD_SLOTS = FILL     // the charter's Limits "Build slots" value, as a number
const DRIVE_SLOTS = FILL     // the charter's Limits "Drive slots" value, as a number
const TEST_NOTES = FILL      // per /testing: the governing TESTING.md sections verbatim (Green included), or "" when the repo has none

const EXECUTOR_MODEL = FILL  // per /model-policy: the executor tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the run genuinely deviates ═══════════

const TIER_MODEL = { executor: EXECUTOR_MODEL }
const tier = t => (TIER_MODEL[t] ? { model: TIER_MODEL[t] } : {})
const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')

const DRIVE_BATCH = 6 // behaviors per verifier — each verifier launches, drives its batch, and cleans up; batches run one after another
const SHORT = SHA.slice(0, 7)
const APP = VERIFY_SKILL.split('/').filter(Boolean).pop().replace(/^verify-/, '')
const HARNESS_PREREQ = 'the verify harness'
// A charter behavior line as a piece's Acceptance line: "B<n>: <behavior> — <end state>".
const clean = t => t.replace(/\*\*/g, '').replace(/^\s*-\s*/, '').trim()

// A workflow agent's turn ending is its final report, so it waits on a long run in the
// foreground, through await.sh beside slot.sh, never on a completion notice.
const AWAIT_CMD = SLOT_CMD.replace(/slot\.sh$/, 'await.sh')
const BUILD_SLOTS_RULE = 'Run every build and test command — compiles, test suites, e2e sections, anything from the test recipes — through the host\'s build slots: sh ' + SLOT_CMD + ' ' + BUILD_SLOTS + ' build -- <command>. It waits for a free slot, then runs the command. Run it in the foreground with the Bash timeout at its 600000 ms maximum. One that can outlast that: start it with run_in_background as <the slot command>; echo "exit: $?" — then wait for it in the foreground with sh ' + AWAIT_CMD + ' <its output file>, which returns within nine minutes saying finished or still running; call it again until it says finished. Never end your turn to wait: your turn ending is your final report, and it stops the run. A run you have not seen finish has no result yet.'
const DRIVE_SLOTS_RULE = 'Start the app through the host\'s drive slots: sh ' + SLOT_CMD + ' ' + DRIVE_SLOTS + ' drive-' + APP + ' -- <the skill\'s launch command>, run with run_in_background, so the slot is held exactly as long as the app runs; the skill\'s Cleanup stops it and frees the slot. Where the app has no long-lived process, run each command that drives it through the drive slots instead. Any build the launch needs goes through the build slots first.'

// ── Schemas ──────────────────────────────────────────────────────────────────

const DRIVE_SCHEMA = {
  type: 'object', required: ['harnessBroken', 'harnessFailure', 'results'],
  properties: {
    harnessBroken: { type: 'boolean', description: 'true when Launch or Doctor failed and the skill\'s own recovery plus one clean relaunch did not fix it' },
    harnessFailure: { type: 'string', description: 'when harnessBroken: the step that failed, the command, and its output; "" otherwise' },
    results: {
      type: 'array', description: 'one entry per behavior in your batch',
      items: {
        type: 'object', required: ['id', 'status', 'observed', 'evidence', 'prerequisite', 'repro'],
        properties: {
          id: { type: 'string' },
          status: { enum: ['proven', 'failed', 'unreachable'] },
          observed: { type: 'string', description: 'one or two lines: the end state you saw yourself' },
          evidence: { type: 'string', description: 'where the captured evidence lives, at the location the skill names' },
          prerequisite: { type: 'string', description: 'when unreachable: what blocked the path to it; "" otherwise' },
          repro: { type: 'string', description: 'when failed: the exact steps, from launch, that reproduce it; "" otherwise' },
        },
      },
    },
  },
}

const TEST_SCHEMA = {
  type: 'object', required: ['result', 'summary', 'failing'],
  properties: {
    result: { enum: ['green', 'red'] },
    summary: { type: 'string', description: 'each command you ran, its lane, and its counts' },
    failing: { type: 'array', items: { type: 'string' }, description: 'each failing test or command, with its failure in one line' },
  },
}

const REPORT_SCHEMA = {
  type: 'object', required: ['defects', 'commented', 'reportComment', 'statusPosted', 'problems'],
  properties: {
    defects: { type: 'array', items: { type: 'object', required: ['key', 'number'], properties: { key: { type: 'string' }, number: { type: 'integer' } } }, description: 'every defect piece you created, by its key' },
    commented: { type: 'array', items: { type: 'integer' }, description: 'open defect pieces you added this run\'s evidence to' },
    reportComment: { type: 'integer', description: 'the id of the report comment on the plan; 0 when it was not posted' },
    statusPosted: { type: 'boolean' },
    problems: { type: 'string', description: 'any step you could not complete, and why; "" when every step landed' },
  },
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const VERIFIER = 'You are a verifier of a wayfinder effort. You prove, by driving the real app the way a user would, which acceptance behaviors hold on one pinned commit of ' + EFFORT_BRANCH + '. You built none of this code: what you observe yourself is the evidence, so report only what you saw. You report; you never fix — change no code and commit nothing.'

function worktreeStep(first) {
  return first
    ? 'Your worktree is ' + WORKTREE + '. From ' + REPO_ROOT + ', put that worktree at ' + SHA + ', detached (git worktree add --detach; never check out ' + EFFORT_BRANCH + ' itself — the gate\'s own checkout holds it): create it if absent; if it exists, an earlier run left it, so discard whatever that run left there and check out ' + SHA + '. Confirm HEAD is ' + SHA + ' before anything else.'
    : 'Your worktree is ' + WORKTREE + ', already at ' + SHA + ', detached. Confirm HEAD is ' + SHA + ' before anything else.'
}

function drivePrompt(batch, first) {
  return j([
    VERIFIER,
    worktreeStep(first),
    'Load the verify skill at ' + VERIFY_SKILL + ' (its SKILL.md, from the worktree) and follow it: Launch, then Doctor, then drive each behavior below through the feature file headed by its ID in the skill\'s feature map, capturing evidence where the skill says, then Cleanup — whatever happened along the way. Run Doctor again whenever anything looks off.',
    DRIVE_SLOTS_RULE,
    BUILD_SLOTS_RULE,
    'Your behaviors, from the charter:',
    batch.map(b => '- ' + b.text).join('\n'),
    'Give each one a status:',
    '- proven — you drove the user\'s path to it and saw the end state its line names. A test passing, a log line alone, or reading the code proves nothing.',
    '- failed — you reached it and the end state was wrong or absent. Drive a failure once more from a clean start: a drive that passes the second time is proven, with both runs in observed; one that fails twice is failed, with the exact steps that reproduce it.',
    '- unreachable — something before it blocked the path (a screen that errors, a step another behavior provides that is broken). Name that prerequisite.',
    'If Launch or Doctor fails and the skill\'s own recovery plus one clean relaunch does not fix it, the harness is broken: stop, run Cleanup, set harnessBroken with what failed, and mark every behavior you did not drive unreachable with prerequisite "' + HARNESS_PREREQ + '".',
  ])
}

function testPrompt() {
  return j([
    'You run the repo\'s tests for a wayfinder Verify, in ' + WORKTREE + ', which is at ' + SHA + ', detached. Confirm HEAD is ' + SHA + ' first. Load /testing and run its Green set — what must pass before a change lands — once, every lane of it. You report; you never fix — change no code and commit nothing.',
    TEST_NOTES ? 'Test recipes (per /testing):\n' + TEST_NOTES : 'The repo has no TESTING.md: take Green from the charter\'s ## CI jobs (' + WF_CMD + ' effort prints them) and run every one.',
    BUILD_SLOTS_RULE,
    'Green means every command passed on this run. A test that fails and then passes on a rerun is red, with both runs reported. Stop anything you started.',
  ])
}

function defectBody(goal, acceptance) {
  return ['## Goal', goal, '', '## Acceptance', ...acceptance.map(a => '- ' + a), '', '## Builds on', '- none'].join('\n')
}

function reportPrompt(reportBody, toFile, toComment) {
  return j([
    'You publish a wayfinder Verify report. Work from ' + REPO_ROOT + '. This effort has no GitHub: its tracker, changes and commit statuses live in a local store reached only through ' + WF_CMD + ' (run it with --help, and <command> --help, before first use). Never read or write the store\'s files directly and never run gh. Labels are /issue-tracker\'s vocabulary (load it). The plan is issue ' + PLAN_REF + '. Do every step exactly once: if an earlier run of this step already did one — a defect piece with the same title open under the plan, the report comment already posted — reuse it rather than repeating it.',
    toFile.length
      ? '1. Create each defect piece below as a piece of the plan — issue create with --parent set to the plan\'s number, labelled impl and wayfinder:defect — with exactly the title and body given:\n' + toFile.map(d => '--- key ' + d.key + ' ---\nTitle: ' + d.title + '\nBody:\n' + d.body).join('\n')
      : '1. There are no new defect pieces to create.',
    toComment.length
      ? '2. Comment on each open defect piece below with the new run\'s evidence, verbatim:\n' + toComment.map(c => '--- #' + c.number + ' ---\n' + c.comment).join('\n')
      : '2. There are no open defect pieces to comment on.',
    '3. Post this comment on the plan, replacing each {{defect:<key>}} with the piece created for that key as its title followed by its number — Title (#<n>) — and each {{open:<n>}} with that open piece the same way; report the comment\'s id as reportComment:\n' + reportBody,
    '4. Post the verify status on the pinned commit: ' + WF_CMD + ' status set ' + SHA + ' wayfinder/verify ' + (STATUS_OK ? 'success "every built behavior proven, suite green"' : 'failure "' + STATUS_FAIL + '"'),
  ])
}

// ── Drive ────────────────────────────────────────────────────────────────────

const built = BEHAVIORS.filter(b => b.built)
const results = new Map() // id → { status, observed, evidence, prerequisite, repro }
let harnessBroken = false
let harnessFailure = ''

phase('Drive')
const batches = []
for (let i = 0; i < built.length; i += DRIVE_BATCH) batches.push(built.slice(i, i + DRIVE_BATCH))
for (const [i, batch] of batches.entries()) {
  if (harnessBroken) {
    for (const b of batch) results.set(b.id, { status: 'unreachable', observed: '', evidence: '', prerequisite: HARNESS_PREREQ, repro: '' })
    continue
  }
  const r = await agent(drivePrompt(batch, i === 0), { ...tier('executor'), schema: DRIVE_SCHEMA, label: 'drive:' + batch.map(b => b.id).join(','), phase: 'Drive' })
  // A verifier that died proves nothing and files nothing: its behaviors are unreachable.
  const byId = new Map(((r && r.results) || []).map(x => [x.id, x]))
  for (const b of batch) {
    const x = byId.get(b.id)
    results.set(b.id, x || { status: 'unreachable', observed: '', evidence: '', prerequisite: r ? 'the verifier returned no result for it' : 'the verifier died', repro: '' })
  }
  if (r && r.harnessBroken) { harnessBroken = true; harnessFailure = r.harnessFailure }
}

// ── Test ─────────────────────────────────────────────────────────────────────

phase('Test')
const test = await agent(testPrompt(), { ...tier('executor'), schema: TEST_SCHEMA, label: 'test:' + SHORT, phase: 'Test' })
const suite = test ? test.result : 'not-run'

// ── Report ───────────────────────────────────────────────────────────────────

const status = b => (b.built ? results.get(b.id).status : 'not-built')
const proven = BEHAVIORS.filter(b => status(b) === 'proven').map(b => b.id)
// On the final run every behavior must be built: one that isn't is a failure.
const failed = BEHAVIORS.filter(b => status(b) === 'failed' || (FINAL && !b.built)).map(b => b.id)
const STATUS_OK = proven.length === built.length && suite === 'green' && !harnessBroken && !(FINAL && built.length < BEHAVIORS.length)
const STATUS_FAIL = [
  harnessBroken ? 'harness broken' : null,
  failed.length ? 'failed: ' + failed.join(', ') : null,
  BEHAVIORS.filter(b => status(b) === 'unreachable').length ? 'unreachable: ' + BEHAVIORS.filter(b => status(b) === 'unreachable').map(b => b.id).join(', ') : null,
  suite !== 'green' ? 'suite ' + suite : null,
].filter(Boolean).join('; ')

// Defect pieces: one per failure, one for a broken harness, one for a red suite —
// unless an open defect already covers it, which gets this run's evidence instead.
const toFile = []
const toComment = []
const ref = {} // behavior id or 'harness' / 'suite' → '{{defect:<key>}}' or '{{open:<n>}}'
function defect(key, coveredBy, title, goal, acceptance, comment) {
  if (coveredBy) { toComment.push({ number: coveredBy.number, comment }); ref[key] = '{{open:' + coveredBy.number + '}}' }
  else { toFile.push({ key, title, body: defectBody(goal, acceptance) }); ref[key] = '{{defect:' + key + '}}' }
}

if (harnessBroken) {
  defect('harness', OPEN_DEFECTS.find(d => d.harness),
    'Fix the verify harness: ' + harnessFailure.split('\n')[0].slice(0, 80),
    'The verify skill at ' + VERIFY_SKILL + ' could not drive the app on ' + EFFORT_BRANCH + ' at ' + SHA + ', so no behavior after it could be verified. This piece goes before everything else.\n\nWhat failed:\n' + harnessFailure,
    ['The verify skill at ' + VERIFY_SKILL + ' launches the app, passes Doctor, and drives one mapped behavior end to end on ' + EFFORT_BRANCH],
    'Verify at ' + SHA + ': still broken' + ':\n' + harnessFailure)
}
for (const id of failed) {
  const b = BEHAVIORS.find(x => x.id === id)
  const r = b.built ? results.get(id) : null
  defect(id, OPEN_DEFECTS.find(d => d.behaviors.includes(id)),
    'Fix ' + id + ': ' + clean(b.text).replace(/^B\d+:\s*/, '').split(' — ')[0].slice(0, 70),
    r
      ? 'Verify drove ' + id + ' on ' + EFFORT_BRANCH + ' at ' + SHA + ' and it failed twice.\n\nTo reproduce:\n' + r.repro + '\n\nObserved: ' + r.observed + '\n\nEvidence: ' + r.evidence
      : 'The final Verify at ' + SHA + ' found ' + id + ' covered by no done piece' + (b.pieces.length ? ' (pieces: ' + b.pieces.map(n => '#' + n).join(', ') + ')' : '') + '.',
    [clean(b.text)],
    'Verify at ' + SHA + ': still failing.' + (r ? '\n\nTo reproduce:\n' + r.repro + '\n\nObserved: ' + r.observed + '\n\nEvidence: ' + r.evidence : ''))
}
if (suite === 'red') {
  defect('suite', OPEN_DEFECTS.find(d => !d.harness && !d.behaviors.length && /green/i.test(d.title)),
    'Fix the Green suite on ' + EFFORT_BRANCH,
    'The Green set per TESTING.md failed on ' + EFFORT_BRANCH + ' at ' + SHA + '.\n\n' + test.summary + '\n\nFailing:\n' + test.failing.map(f => '- ' + f).join('\n'),
    ['The Green set per TESTING.md passes on ' + EFFORT_BRANCH],
    'Verify at ' + SHA + ': still red' + ':\n' + test.failing.map(f => '- ' + f).join('\n'))
}

const STATUS_WORD = { proven: 'proven', failed: 'failed', unreachable: 'unreachable', 'not-built': 'not built' }
const row = b => {
  const s = status(b)
  const r = b.built ? results.get(b.id) : null
  const detail = s === 'unreachable' ? 'blocked by ' + r.prerequisite : (r ? r.observed : '')
  return '| ' + b.id + ' | ' + (FINAL && !b.built ? 'failed (not built)' : STATUS_WORD[s]) + ' | ' + (detail || '').replace(/\|/g, '\\|').replace(/\n/g, ' ') + ' | ' + (r && r.evidence ? r.evidence.replace(/\|/g, '\\|') : '') + ' | ' + (ref[b.id] || '') + ' |'
}
const reportBody = [
  '<!-- wayfinder verify ' + SHA + ' -->',
  '## ' + (FINAL ? 'Final Verify' : 'Verify') + ' at ' + SHORT,
  FINAL ? 'The commit the human will be asked to accept.' : null,
  harnessBroken ? '\n**The verify harness is broken** — ' + ref.harness + ' goes before everything else.\n\n' + harnessFailure : null,
  '',
  '| Behavior | Status | Observed | Evidence | Defect |',
  '| --- | --- | --- | --- | --- |',
  ...BEHAVIORS.map(row),
  '',
  '**Suite (Green per TESTING.md):** ' + (test ? test.result + ' — ' + test.summary : 'not run — the test agent died') + (ref.suite ? ' — ' + ref.suite : ''),
  '',
  '**wayfinder/verify:** ' + (STATUS_OK ? 'success' : 'failure — ' + STATUS_FAIL),
].filter(x => x !== null).join('\n')

phase('Report')
const rep = await agent(reportPrompt(reportBody, toFile, toComment), { ...tier('executor'), schema: REPORT_SCHEMA, label: 'report:' + SHORT, phase: 'Report' })
if (!rep) throw new Error('The report agent for ' + SHORT + ' died; the report may be partly posted — a relaunch reuses what landed')
if (rep.problems) log('Verify report ' + SHORT + ': ' + rep.problems)

log('Verify ' + SHORT + ': ' + proven.length + '/' + built.length + ' built behaviors proven, suite ' + suite + (harnessBroken ? ', harness broken' : ''))
return {
  status: 'reported',
  sha: SHA,
  proven,
  failed,
  defects: rep.defects.map(d => d.number).concat(rep.commented),
  harnessBroken,
}
