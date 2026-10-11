export const meta = {
  name: 'iterate-build',
  description: 'Build one /iterate slice: plan each part → collision check → implement in worktrees → merge into the effort branch in completion order, never on red → run the brief\'s checks on the merged branch',
  phases: [
    { title: 'Plan', detail: 'one decider-tier planner per part, then a collision check over the plans (both skipped for a one-part brief)' },
    { title: 'Implement', detail: 'one executor-tier implementer per part, each in an isolated worktree' },
    { title: 'Merge', detail: 'strictly serialized executor-tier merges in implementer-completion order; tests after each' },
    { title: 'Check', detail: 'one executor-tier agent runs the slice\'s scoped tests and every Done when check it can on the merged branch (skipped when a part parked)' },
  ],
}

// Template for the /iterate build workflow. This file owns every build agent's
// prompt; SKILL.md says what the build is for. The plan → collision → implement →
// merge shape is /ship's wave, minus the tracker (the effort log is the spec, and
// reports come back to the session, which alone writes the log) and minus
// verification (that is the slice's Review stage). The Check phase runs the
// brief's Done when checks so the session opens Reflect with results in hand.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes). Nothing goes
// through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const SLICE = FILL           // slice number n
const LOG_DIR = FILL         // the effort log directory's repo path, e.g. "apps/raidboss/docs/efforts/raidboss-revival"
const EFFORT_BRANCH = FILL   // the index's Branch: line — merges land here
const PARTS = FILL           // [{ name: "dev-page", body: "the part's brief text verbatim, Done when included", branch: "<effort branch>-slice-<n>-dev-page", resume: false }]
                             // one entry for a brief without parts (name "", branch "<effort branch>-slice-<n>", body the whole brief);
                             // resume: true when the branch already holds commits from a dead build
const TEST_NOTES = FILL      // per /testing: the governing TESTING.md sections verbatim, or "" when the repo has none

const EXECUTOR_MODEL = FILL  // per /model-policy: the executor tier's resolved model, or null to inherit
const DECIDER_MODEL = FILL   // per /model-policy: the decider tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the build genuinely deviates ═══════════

const TIER_MODEL = { executor: EXECUTOR_MODEL, decider: DECIDER_MODEL }
const tier = t => (TIER_MODEL[t] ? { model: TIER_MODEL[t] } : {})
const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')

const SPLIT = PARTS.length > 1
const label = p => p.name || 'slice-' + SLICE

const CONTEXT = j([
  'You are working on one slice of a feature that is being grown iteratively. On branch ' + EFFORT_BRANCH + ', read ' + LOG_DIR + '/index.md for its Destination and Where it stands — your context — and ' + LOG_DIR + '/slice-' + SLICE + '.md, whose Decisions and Brief are your spec. Leave the log untouched — the session that launched you is its only writer.',
  SPLIT ? 'The brief is split into parts built in parallel by separate agents against the same Decisions: ' + PARTS.map(p => p.name).join(', ') + '. Hold to the contracts the Decisions pin between them.' : null,
])

const PLAN_SCHEMA = {
  type: 'object', required: ['status', 'plan', 'files', 'seams'],
  properties: {
    status: { enum: ['planned', 'parked'] },
    plan: { type: 'string', description: 'the implementation plan; the park reason when parked' },
    files: { type: 'array', items: { type: 'string' }, description: 'files the work is expected to change' },
    seams: { type: 'array', items: { type: 'string' }, description: 'seams the work will touch or reshape' },
  },
}

const COLLISION_SCHEMA = {
  type: 'object', required: ['amendments', 'mergeNotes'],
  properties: {
    amendments: { type: 'array', items: { type: 'object', required: ['part', 'amendment'], properties: { part: { type: 'string' }, amendment: { type: 'string' } } } },
    mergeNotes: { type: 'array', items: { type: 'string' }, description: 'tensions that could not be reconciled — baked into the merge briefs' },
  },
}

const IMPL_SCHEMA = {
  type: 'object', required: ['status', 'branch', 'built', 'howToSee', 'deviations'],
  properties: {
    status: { enum: ['done', 'parked'] },
    branch: { type: 'string', description: 'the branch holding the commits; "" when parked with none' },
    built: { type: 'string', description: 'what was built; when parked, exactly what is missing' },
    howToSee: { type: 'string', description: 'how to see it running' },
    deviations: { type: 'string', description: 'open details decided as the smallest reversible option, or ""' },
  },
}

const MERGE_SCHEMA = {
  type: 'object', required: ['status', 'sha', 'testSummary'],
  properties: {
    status: { enum: ['merged', 'parked'] },
    sha: { type: 'string', description: EFFORT_BRANCH + ' HEAD after the merge; "" when parked' },
    testSummary: { type: 'string', description: 'tests run and their result; the failure when parked' },
  },
}

function plannerPrompt(p) {
  return j([
    CONTEXT,
    'You are the planner for part ' + p.name + '. Explore ' + EFFORT_BRANCH + ' as it stands now and write the part\'s implementation plan: where the work lands, the approach, the seams it touches, the files it expects to change, and where the red tests go first. Your implementer gets exactly this plan.',
    'Your part:',
    p.body,
    'If the part cannot be built as the Decisions stand — something that would change what the slice delivers — return status=parked with exactly what is missing.',
  ])
}

function collisionPrompt(planned, overlaps) {
  return j([
    'You are the collision check for slice ' + SLICE + '. Parallel implementers are about to build these plans against the same branch; reconcile plans that reshape the same seam differently. A seam is not a file — watch for plans converging on the same interface, duplicating a helper, or shaping the same contract in disjoint files.',
    'File overlaps (a focus aid, not the whole story):',
    overlaps.length ? overlaps.map(o => '- ' + o).join('\n') : '- none — check seam-level convergence anyway',
    'The plans:',
    JSON.stringify(planned.map(x => ({ part: x.p.name, plan: x.plan.plan, files: x.plan.files, seams: x.plan.seams }))),
    'Where one shape serves both, amend the losing plan. What you cannot reconcile becomes a mergeNote — the merge agent inherits it, never the human.',
  ])
}

function implementerPrompt(p, plan, amendment) {
  return j([
    CONTEXT,
    'You build ' + (SPLIT ? 'part ' + p.name + ' only' : 'the slice') + ', in an isolated worktree, on branch ' + p.branch + '.' + (p.resume ? ' The branch already holds commits from an earlier build that died — continue from them.' : ''),
    SPLIT ? 'Your part:\n' + p.body : null,
    plan ? 'Your plan:\n' + plan.plan : null,
    amendment ? 'Collision-check amendment — build against this shared shape:\n' + amendment : null,
    'Load /tdd and /testing first, then build test-first at the seams the Decisions name.',
    TEST_NOTES ? 'Test recipes (per /testing) — before you report done, run the unit invocations of the Scoping to a change rule applied to the files you touched:\n' + TEST_NOTES : null,
    'Stay inside the brief: a detail it leaves open that you need, take the smallest reversible option and note it as a deviation; something that would change what the slice delivers, stop and park. Commit as you go.',
  ])
}

function mergePrompt(p, branch, notes) {
  return j([
    'You are a merge agent for slice ' + SLICE + ', working in the main checkout. Merge branch ' + branch + (SPLIT ? ' (part ' + p.name + ')' : '') + ' into ' + EFFORT_BRANCH + '. Verify you are on ' + EFFORT_BRANCH + ' first.',
    notes.length ? 'Unreconciled collision notes from planning — you inherit these:\n' + notes.map(n => '- ' + n).join('\n') : null,
    'On conflict, resolve preserving both parts\' intent. After the merge, run the integration invocations of the Scoping to a change rule applied to the merged files (the whole scoped set when the recipes don\'t split unit from integration).',
    TEST_NOTES ? 'Test recipes (per /testing):\n' + TEST_NOTES : null,
    'Never merge on red: a branch that cannot come green is parked — abort or revert so ' + EFFORT_BRANCH + ' stays green, and return status=parked with the failure.',
  ])
}

const CHECK_SCHEMA = {
  type: 'object', required: ['testSummary', 'checks'],
  properties: {
    testSummary: { type: 'string', description: 'the slice\'s scoped test run on ' + EFFORT_BRANCH + ' and its result' },
    checks: { type: 'array', items: { type: 'object', required: ['check', 'result', 'detail'], properties: {
      check: { type: 'string', description: 'the Done when check, verbatim from the brief' },
      result: { enum: ['pass', 'fail', 'not-run'] },
      detail: { type: 'string', description: 'what was run and what it showed; for not-run, what it needs (the human\'s eyes, a credential, a device)' },
    } } },
  },
}

function checkPrompt(done) {
  return j([
    CONTEXT,
    'You are the check agent for slice ' + SLICE + ', working in the main checkout on ' + EFFORT_BRANCH + ', where every part has now merged:',
    done.map(r => '- ' + (r.part || 'slice-' + SLICE) + ' — ' + r.built + (r.howToSee ? ' (to see it: ' + r.howToSee + ')' : '')).join('\n'),
    'First run the slice\'s scoped tests: the Scoping to a change rule applied to every file the slice changed.',
    TEST_NOTES ? 'Test recipes (per /testing):\n' + TEST_NOTES : null,
    'Then take every Done when check in the brief, the parts\' included, and run each one an agent can — a test, a command, starting the app and exercising it, a load run. A check that needs a human\'s eyes, a credential, or a device you lack is not-run, with what it needs.',
    'You report; you never fix. Leave the code and the log untouched, commit nothing, and stop anything you started.',
  ])
}

// ── Plan ─────────────────────────────────────────────────────────────────────

const reports = [] // { part, status, branch, built, howToSee, deviations, sha, testSummary }
let active = PARTS.map(p => ({ p, plan: null }))
const amendments = new Map()
let mergeNotes = []

if (SPLIT) {
  phase('Plan')
  const plans = await parallel(PARTS.map(p => () =>
    agent(plannerPrompt(p), { ...tier('decider'), schema: PLAN_SCHEMA, label: 'plan:' + p.name, phase: 'Plan' }).then(plan => ({ p, plan }))))
  active = []
  for (const [i, x] of plans.entries()) {
    const p = PARTS[i]
    if (!x || !x.plan || x.plan.status === 'parked') {
      reports.push({ part: p.name, status: 'parked', branch: '', built: x && x.plan ? x.plan.plan : 'planner died', howToSee: '', deviations: '' })
    } else active.push(x)
  }
  // Always an agent when 2+ remain: a seam is not a file, so overlaps only focus the brief.
  if (active.length > 1) {
    const overlaps = []
    for (let a = 0; a < active.length; a++) {
      for (let b = a + 1; b < active.length; b++) {
        const shared = active[a].plan.files.filter(f => active[b].plan.files.includes(f))
        if (shared.length) overlaps.push(active[a].p.name + ' ∩ ' + active[b].p.name + ': ' + shared.join(', '))
      }
    }
    const c = await agent(collisionPrompt(active, overlaps), { ...tier('decider'), schema: COLLISION_SCHEMA, label: 'collision-check', phase: 'Plan' })
    if (c) {
      for (const a of c.amendments) amendments.set(a.part, a.amendment)
      mergeNotes = c.mergeNotes
    }
  }
}

// ── Implement, then merge in completion order ────────────────────────────────
// Each merge chains onto a shared promise: strictly serialized, but the first part
// to finish merges while the slowest is still building. Parts are independent by
// the brief's construction, so completion order is safe.

let mergeLock = Promise.resolve()
await parallel(active.map(({ p, plan }) => async () => {
  const impl = await agent(implementerPrompt(p, plan, amendments.get(p.name)),
    { ...tier('executor'), schema: IMPL_SCHEMA, isolation: 'worktree', label: 'impl:' + label(p), phase: 'Implement' })
  if (!impl || impl.status === 'parked' || !impl.branch) {
    reports.push({ part: p.name, status: 'parked', branch: impl ? impl.branch : '', built: impl ? impl.built : 'implementer died', howToSee: '', deviations: impl ? impl.deviations : '' })
    return
  }
  const myTurn = mergeLock.then(() =>
    agent(mergePrompt(p, impl.branch, mergeNotes), { ...tier('executor'), schema: MERGE_SCHEMA, label: 'merge:' + label(p), phase: 'Merge' }))
  mergeLock = myTurn.catch(() => null) // a failed merge never blocks the chain
  const m = await myTurn
  reports.push({
    part: p.name, branch: impl.branch, built: impl.built, howToSee: impl.howToSee, deviations: impl.deviations,
    status: m && m.status === 'merged' ? 'done' : 'parked',
    sha: m ? m.sha : '', testSummary: m ? m.testSummary : 'merge agent died',
  })
}))

// ── Check ────────────────────────────────────────────────────────────────────
// Only a fully merged slice: a parked part sends the slice back to shaping.

let check = null
const done = reports.filter(r => r.status === 'done')
if (done.length && done.length === PARTS.length) {
  phase('Check')
  check = await agent(checkPrompt(done), { ...tier('executor'), schema: CHECK_SCHEMA, label: 'check:slice-' + SLICE, phase: 'Check' })
}

log('Slice ' + SLICE + ': ' + done.length + ' merged, ' + reports.filter(r => r.status === 'parked').length + ' parked' + (check ? ', ' + check.checks.filter(c => c.result === 'pass').length + '/' + check.checks.length + ' checks passed' : ''))
return { reports, check }
