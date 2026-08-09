export const meta = {
  name: 'ship',
  description: "Implement a spec's ticket DAG in waves — parallel worktree implementers, serial merge, wave review, confident fixes, wave summary",
}

// Template for the /ship implementation workflow — SKILL.md step 2 holds the wave
// stages this file encodes; keep the two in sync when either changes.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch — loud,
// before any ticket is claimed. Fill prose slots (kernel, decisions, ticket
// bodies, tracker ops) as JSON string literals (double quotes, \n escapes):
// mechanical to produce, and immune to the backticks and apostrophes that
// terminate template literals and single-quoted strings. Nothing goes through
// `args` — the DAG is inlined, never threaded.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const SPEC_ISSUE = FILL     // "#42" — the spec issue ref
const BRANCH = FILL         // "spec-42-slug" — the ship branch, already created and checked out
const SPEC_KERNEL = FILL    // kernel body: Testing Decisions + Seams under test verbatim, Decision Index included (pre-index spec: the whole body)
const DECISIONS = FILL      // { "D-3": "full decision text", ... } — every decision any ticket cites; {} for a pre-index spec
const TICKETS = FILL        // the DAG as a literal (step 1 already read it): [{ id: "#43", title: "...", body: "...", blockedBy: ["#44"], decisionIds: ["D-3"] }]
const TRACKER_OPS = FILL    // paste the tracker doc's operations agents need: claim/unclaim (+ bootstrap), close-with-comment, comment-on-issue, read-decision-by-ID
const TEST_CMD = FILL       // full-suite command ("npm test"); "" → agents discover it from the repo
const STANDARDS_NOTE = FILL // one line pointing the wave reviewer at the governing standards sources (per /conventions), or ""

// ═══════════ FIXED BELOW THIS LINE — edit only when the run genuinely deviates ═══════════

const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')
const ticketBranch = id => 'ticket-' + String(id).replace(/[^A-Za-z0-9]+/g, '')

// Fail loud before any agent spawns: every cited decision must be present, every
// blocking edge must point at a ticket in the DAG.
if (!Array.isArray(TICKETS) || !TICKETS.length) throw new Error('TICKETS is empty — nothing to ship')
const ids = new Set(TICKETS.map(t => t.id))
for (const t of TICKETS) {
  const absent = (t.decisionIds || []).filter(d => !(d in DECISIONS))
  if (absent.length) throw new Error('ticket ' + t.id + ' cites decisions absent from DECISIONS: ' + absent.join(', '))
  const dangling = (t.blockedBy || []).filter(b => !ids.has(b))
  if (dangling.length) throw new Error('ticket ' + t.id + ' blocked by unknown tickets: ' + dangling.join(', '))
}

const citedDecisions = t => (t.decisionIds || []).map(d => '### ' + d + '\n' + DECISIONS[d]).join('\n\n')

// ── Schemas ──────────────────────────────────────────────────────────────────

const CLAIM_SCHEMA = {
  type: 'object', required: ['claimed', 'failed'],
  properties: {
    claimed: { type: 'array', items: { type: 'string' } },
    failed: { type: 'array', items: { type: 'object', required: ['id', 'reason'], properties: { id: { type: 'string' }, reason: { type: 'string' } } } },
  },
}

const IMPL_SCHEMA = {
  type: 'object', required: ['ticketId', 'status', 'branch', 'commits', 'parkReason'],
  properties: {
    ticketId: { type: 'string' },
    status: { enum: ['done', 'parked'] },
    branch: { type: 'string', description: 'the worktree branch the commits live on; "" when parked' },
    commits: { type: 'array', items: { type: 'string' }, description: 'one-line description per commit' },
    parkReason: { type: 'string', description: '"" unless parked' },
  },
}

const MERGE_SCHEMA = {
  type: 'object', required: ['baseSha', 'merged', 'parked'],
  properties: {
    baseSha: { type: 'string', description: 'HEAD of the ship branch before the first merge — the wave review diffs from here' },
    merged: { type: 'array', items: { type: 'object', required: ['id', 'mergeSha'], properties: { id: { type: 'string' }, mergeSha: { type: 'string' } } } },
    parked: { type: 'array', items: { type: 'object', required: ['id', 'reason'], properties: { id: { type: 'string' }, reason: { type: 'string' } } } },
  },
}

const WAVE_REVIEW_SCHEMA = {
  type: 'object', required: ['confidentFixes', 'deferred', 'specGaps'],
  properties: {
    confidentFixes: {
      type: 'array',
      items: {
        type: 'object', required: ['file', 'snippet', 'standard', 'fix'],
        properties: {
          file: { type: 'string' },
          snippet: { type: 'string', description: 'short quoted snippet anchoring the edit — never a bare line number' },
          standard: { type: 'string', description: 'the documented standard breached (file + rule)' },
          fix: { type: 'string', description: 'the fix, stated outright' },
        },
      },
    },
    deferred: { type: 'array', items: { type: 'string' }, description: 'one line each — judgement calls, repo-wide patterns, spec divergences, for the closing /review' },
    specGaps: { type: 'array', items: { type: 'string' }, description: 'divergences where the SPEC may be wrong — commented on the spec issue this wave' },
  },
}

const FIX_SCHEMA = {
  type: 'object', required: ['applied', 'skipped'],
  properties: {
    applied: { type: 'array', items: { type: 'object', required: ['fix', 'sha'], properties: { fix: { type: 'string' }, sha: { type: 'string' } } } },
    skipped: { type: 'array', items: { type: 'object', required: ['fix', 'reason'], properties: { fix: { type: 'string' }, reason: { type: 'string' } } } },
  },
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function claimPrompt(frontier) {
  return j([
    'You claim tickets for one wave of shipping spec ' + SPEC_ISSUE + '.',
    'Tracker operations:',
    TRACKER_OPS,
    'Run the bootstrap first if the claim markers do not exist. Claim EACH of these tickets, then verify the claim check passes for each:',
    JSON.stringify(frontier.map(t => t.id)),
    'Report the claimed IDs and every failure with its reason — a ticket you cannot claim is excluded from the wave.',
  ])
}

function implPrompt(t) {
  return j([
    'You implement exactly one ticket of spec ' + SPEC_ISSUE + ', in your own isolated worktree. Never touch work outside this ticket — fresh context per ticket is the point.',
    'FIRST ACTION: confirm your ticket carries the in-progress marker (tracker operations below). If it does not, stop and report status=parked with parkReason "not claimed".',
    'Your ticket: ' + t.id + ' — ' + t.title,
    'Ticket body:',
    t.body,
    'Spec kernel (Testing Decisions and Seams under test are verbatim requirements; the Decision Index routes everything else):',
    SPEC_KERNEL,
    (t.decisionIds || []).length
      ? 'Full text of the decisions your ticket cites — this bounded set is your decision context; the rest of the log is deliberately withheld:\n' + citedDecisions(t)
      : 'Your ticket cites no decisions.',
    'If you need a decision your ticket does not cite, check the Decision Index first: if it routes there, fetch that decision by ID (tracker read below) and note the missed routing in a ticket comment. A decision the spec does not hold ANYWHERE, or work no listed seam covers, is a PARK — ship never makes product decisions: unclaim the ticket, comment exactly what is missing on the ticket, comment the gap on spec issue ' + SPEC_ISSUE + ', and report status=parked.',
    'Discipline: invoke the implement and tdd skills if available; regardless — red–green at the spec\'s seams, typecheck regularly, run single test files as you go, and commit in your worktree on a branch named ' + ticketBranch(t.id) + '.',
    TEST_CMD ? 'Full test suite: ' + TEST_CMD : null,
    'Tracker operations:',
    TRACKER_OPS,
  ])
}

function mergePrompt(wave, finished) {
  return j([
    'You are the serial merge agent for wave ' + wave + ' of spec ' + SPEC_ISSUE + '. Work in the MAIN checkout on branch ' + BRANCH + ' — verify with git rev-parse --abbrev-ref HEAD, check it out if needed, and record its HEAD sha first (report it as baseSha).',
    'Merge these ticket branches ONE AT A TIME, in the order listed. Blocking edges encode logical order, not file overlap — this serial merge is where overlap surfaces. After each merge run the affected tests (full suite if cheap' + (TEST_CMD ? ': ' + TEST_CMD : '') + ').',
    JSON.stringify(finished.map(r => ({ ticket: r.ticketId, branch: r.branch, commits: r.commits }))),
    'On conflict: resolve preserving BOTH tickets\' intent, then re-test. NEVER merge on red — a branch that cannot come green is parked like any other: skip it and report it parked with the failure.',
    'On green: close the ticket with a comment linking its commits and remove the in-progress marker (tracker operations below).',
    'Tracker operations:',
    TRACKER_OPS,
  ])
}

function waveReviewPrompt(wave, baseSha, mergedTickets) {
  const waveDecisionIds = [...new Set(mergedTickets.flatMap(t => t.decisionIds || []))]
  return j([
    'You review wave ' + wave + ' of spec ' + SPEC_ISSUE + ' — the wave\'s COMBINED merged diff, deliberately: you see how parallel tickets compose.',
    'Diff command: git diff ' + baseSha + '..HEAD',
    'Review along both axes:',
    '1. Standards — the repo\'s documented standards. ' + (STANDARDS_NOTE || 'Source them per the /conventions skill: CONVENTIONS.md at root plus any nearer scoped one; fall back to CODING_STANDARDS.md / CONTRIBUTING.md / STYLEGUIDE.md for repos not using the convention.'),
    '2. Fidelity to the tickets and the spec.',
    'The wave\'s tickets:',
    JSON.stringify(mergedTickets.map(t => ({ id: t.id, title: t.title, body: t.body }))),
    'Spec kernel:',
    SPEC_KERNEL,
    waveDecisionIds.length
      ? 'Full text of every decision the wave\'s tickets cite (contract snippets included):\n' + waveDecisionIds.map(d => '### ' + d + '\n' + DECISIONS[d]).join('\n\n')
      : 'The wave\'s tickets cite no decisions.',
    'Output: confidentFixes = ONLY documented-standard hard violations whose fix you can state outright (this pass is deliberately lighter than /review — no proposer/validator pipeline mid-run). Everything else — judgement calls, repo-wide patterns, spec divergences — goes in deferred, one line each, for the closing /review. Exception: a divergence where the SPEC may be wrong goes in specGaps — the spec issue hears about it this wave, so the spec stays truthful.',
  ])
}

function fixPrompt(fixes) {
  return j([
    'You are the wave fix agent for spec ' + SPEC_ISSUE + '. Apply ONLY the confident standards fixes below — serially, in the MAIN checkout on branch ' + BRANCH + ', one commit each, testing after each (affected tests; full suite if cheap' + (TEST_CMD ? ': ' + TEST_CMD : '') + ').',
    'Anchor each edit by its quoted snippet, never by line number. If a fix breaks tests, revert it and report it skipped with the failure.',
    JSON.stringify(fixes),
  ])
}

function summaryPrompt(wave, w) {
  return j([
    'Post ONE comment on spec issue ' + SPEC_ISSUE + ' (tracker operations below) summarizing wave ' + wave + ' of shipping. Content:',
    '- Tickets landed: ' + (w.landed.map(x => x.id + ' (' + x.mergeSha + ')').join(', ') || 'none'),
    '- Tickets parked: ' + (w.parked.map(x => x.id + ' — ' + x.reason).join('; ') || 'none'),
    '- Confident fixes applied: ' + w.fixesApplied.length + (w.fixesApplied.length ? ' (' + w.fixesApplied.map(x => x.sha).join(', ') + ')' : ''),
    '- Findings deferred to the closing review: ' + (w.deferred.join('; ') || 'none'),
    w.specGaps.length ? 'Also state each spec gap plainly in the comment — the spec may be wrong here: ' + w.specGaps.join('; ') : null,
    'Tracker operations:',
    TRACKER_OPS,
  ])
}

// ── Wave loop ────────────────────────────────────────────────────────────────

const done = new Set()
const parked = []
const parkedIds = new Set()
const waves = []
const park = (id, reason) => { if (!parkedIds.has(id)) { parkedIds.add(id); parked.push({ id, reason }) } }

let wave = 0
while (true) {
  const open = TICKETS.filter(t => !done.has(t.id) && !parkedIds.has(t.id))
  if (!open.length) break
  const frontier = open.filter(t => (t.blockedBy || []).every(b => done.has(b)))
  if (!frontier.length) {
    // A parked ticket doesn't stop the run unless it blocks everything — this is that case.
    log('Stopping: ' + open.length + ' remaining tickets all wait on parked work (' + open.map(t => t.id).join(', ') + ')')
    break
  }
  wave++
  phase('Wave ' + wave)
  log('Wave ' + wave + ' frontier: ' + frontier.map(t => t.id).join(', '))

  // 1. Claim — verified before any implementer spawns.
  const claim = (await agent(claimPrompt(frontier), { schema: CLAIM_SCHEMA, label: 'claim' })) || { claimed: [], failed: frontier.map(t => ({ id: t.id, reason: 'claim agent died' })) }
  for (const f of claim.failed) park(f.id, 'claim failed: ' + f.reason)
  const claimed = frontier.filter(t => claim.claimed.includes(t.id))

  // 2. Parallel implement — one fresh agent per ticket, each in an isolated worktree.
  const impls = (await parallel(claimed.map(t => () =>
    agent(implPrompt(t), { schema: IMPL_SCHEMA, isolation: 'worktree', label: 'impl:' + t.id })
      .then(r => r || { ticketId: t.id, status: 'parked', branch: '', commits: [], parkReason: 'implementer died' }))))
    .filter(Boolean)
  for (const r of impls) if (r.status === 'parked') park(r.ticketId, r.parkReason)
  const finished = impls.filter(r => r.status === 'done')

  // 3. Serial merge — one agent, one branch at a time, never on red.
  let merge = { baseSha: '', merged: [], parked: [] }
  if (finished.length) {
    merge = (await agent(mergePrompt(wave, finished), { schema: MERGE_SCHEMA, label: 'merge' })) ||
      { baseSha: '', merged: [], parked: finished.map(r => ({ id: r.ticketId, reason: 'merge agent died' })) }
  }
  for (const m of merge.merged) done.add(m.id)
  for (const p of merge.parked) park(p.id, 'merge: ' + p.reason)

  // 4–5. Wave review over the combined merged diff, then confident fixes only.
  // A very wide wave may warrant splitting this review by subsystem — edit here if so.
  const mergedTickets = TICKETS.filter(t => merge.merged.some(m => m.id === t.id))
  let review = { confidentFixes: [], deferred: [], specGaps: [] }
  let fixesApplied = []
  if (mergedTickets.length && merge.baseSha) {
    review = (await agent(waveReviewPrompt(wave, merge.baseSha, mergedTickets), { schema: WAVE_REVIEW_SCHEMA, label: 'wave-review' })) ||
      { confidentFixes: [], deferred: ['wave ' + wave + ' review agent died — closing review must cover this wave'], specGaps: [] }
    if (review.confidentFixes.length) {
      const fixed = (await agent(fixPrompt(review.confidentFixes), { schema: FIX_SCHEMA, label: 'fixes' })) || { applied: [], skipped: [] }
      fixesApplied = fixed.applied
      for (const s of fixed.skipped) review.deferred.push('fix skipped (' + s.reason + '): ' + s.fix)
    }
  }

  const w = {
    wave,
    landed: merge.merged,
    parked: parked.filter(p => frontier.some(t => t.id === p.id)),
    fixesApplied,
    deferred: review.deferred,
    specGaps: review.specGaps,
  }
  waves.push(w)

  // 6. Wave summary — one comment on the spec issue.
  await agent(summaryPrompt(wave, w), { label: 'summary' })
}

return {
  branch: BRANCH,
  waves,
  landed: [...done],
  parked,
  deferred: waves.flatMap(w => w.deferred),
  specGaps: waves.flatMap(w => w.specGaps),
}
