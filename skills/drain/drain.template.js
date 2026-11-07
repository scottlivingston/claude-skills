export const meta = {
  name: 'drain-round',
  description: 'One /drain round over a wayfinder map: resolve every claimed afk ticket in parallel, each reconsider plan attacked by a fresh refuter before it posts, results returned in finishing order for the coordinator to fold',
  phases: [
    { title: 'Resolve', detail: 'one decider-tier agent per ticket; a reconsider ticket drafts its correction plan here' },
    { title: 'Refute', detail: 'reconsider plans only: a fresh decider tries to refute each, one revision round, then a second refuter' },
    { title: 'Record', detail: 'reconsider plans only: post the surviving plan as the record, or escalate it' },
  ],
}

// Template for one /drain round. /drain's SKILL.md owns the ticket brief and the
// folding; /wayfinder owns what a correction plan is and when it escalates. This
// file owns how a round runs: one agent per ticket, the reconsider refutation as
// its own stages, and the shape each result comes back in. Agents never edit the
// map body; the coordinator folds the returned results after the round.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes): JSON.stringify or
// Python's json.dumps, spliced in with a plain string replace. Nothing goes
// through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const MAP = FILL             // the map issue, e.g. "#120" or its URL
const MAP_CONTEXT = FILL     // the map body's Destination, Principles, Design, and Notes sections, verbatim
const DRAIN_SKILL = FILL     // absolute path of the installed drain skill's SKILL.md (its "The agent brief" section)
const TICKETS = FILL         // the tickets claimed for this round:
                             // [{ ref: "#131", title: "...", type: "decision", body: "the ticket body verbatim", blocks: ["#140 title", ...] }]
                             // type is the wayfinder:<type> label's suffix: decision, design, prototype, research, task, or reconsider

const DECIDER_MODEL = FILL   // per /model-policy: the decider tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the round genuinely deviates ═══════════

const tier = () => (DECIDER_MODEL ? { model: DECIDER_MODEL } : {})
const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')

const RESULT_SCHEMA = {
  type: 'object', required: ['status', 'gist', 'proposals', 'friction', 'note'],
  properties: {
    status: { enum: ['closed', 'escalated', 'stopped'], description: 'closed: resolved and closed; escalated: left open with its escalation draft; stopped: left open, blocked on access or otherwise unable to finish' },
    gist: { type: 'string', description: 'the resolution in one line, or why it stopped' },
    proposals: { type: 'boolean', description: 'true when the record ends with a ## Map changes proposed section' },
    friction: { type: 'array', items: { type: 'string' }, description: 'the decisions this ticket posted friction notes on' },
    note: { type: 'string', description: 'anything the coordinator needs when folding; "" when nothing' },
  },
}

const PLAN_SCHEMA = {
  type: 'object', required: ['outcome', 'plan', 'escalate', 'escalationReason'],
  properties: {
    outcome: { enum: ['stands', 'amend', 'supersede'] },
    plan: { type: 'string', description: 'the full correction plan, as it would be posted as the record' },
    escalate: { type: 'boolean', description: 'true when the plan falls in one of /deciding\'s three cases' },
    escalationReason: { type: 'string', description: 'which case, or ""' },
  },
}

const REFUTE_SCHEMA = {
  type: 'object', required: ['refuted', 'refutation'],
  properties: {
    refuted: { type: 'boolean' },
    refutation: { type: 'string', description: 'why the plan fails against the grounds or a dependent\'s record; "" when it holds' },
  },
}

const STOPPED = t => ({ ticket: t.ref, title: t.title, status: 'stopped', gist: 'the agent died before returning', proposals: false, friction: [], note: 'the ticket may still be claimed; check it, unclaim it, and leave it on the frontier' })

function ticketHead(t) {
  return j([
    'You are working one ticket of the wayfinder map ' + MAP + ', in parallel with agents working its other frontier tickets. You have already been assigned and claimed it.',
    'The map (Destination, Principles, Design, Notes):',
    MAP_CONTEXT,
    'Your ticket ' + t.ref + ' (' + t.type + '): ' + t.title,
    t.body,
    t.blocks.length ? 'It blocks: ' + t.blocks.join('; ') : 'It blocks no other ticket.',
    'Load /issue-tracker for every tracker operation. Edit no other ticket\'s body and never the map body.',
  ])
}

function resolvePrompt(t) {
  return j([
    ticketHead(t),
    'Read the "The agent brief" section of ' + DRAIN_SKILL + ' and work your ticket per it.',
    'Return the result in the structured fields.',
  ])
}

function planPrompt(t, prior) {
  return j([
    ticketHead(t),
    'This is a reconsider ticket. Load /wayfinder and /deciding, and draft the correction plan per wayfinder\'s Reconsideration: read the decision\'s record, every friction note on it, its dependents followed transitively, and whatever has been learned since.',
    'Draft only: post nothing, change no ticket, and keep your claim. A fresh agent will try to refute the plan before it is posted.',
    prior ? 'Your earlier plan was refuted. Revise it against the refutation, or show why the refutation fails.\nEarlier plan:\n' + prior.plan.plan + '\nRefutation:\n' + prior.refute.refutation : null,
  ])
}

function refutePrompt(t, plan) {
  return j([
    'You are attacking a correction plan for a decision on the wayfinder map ' + MAP + '. You did not write it. Load /wayfinder and /deciding. Read the reconsider ticket ' + t.ref + ', the decision it names with every friction note on it, and the records of its dependents. Try to refute the plan against the decision\'s grounds and those records. Post nothing and change nothing.',
    'The map (Destination, Principles, Design, Notes):',
    MAP_CONTEXT,
    'The plan (' + plan.outcome + '):',
    plan.plan,
    'Return refuted=true only with a concrete refutation; a plan you cannot break holds.',
  ])
}

function recordPrompt(t, plan, escalation) {
  return j([
    ticketHead(t),
    'This is a reconsider ticket whose correction plan has been drafted and attacked. Load /wayfinder and /deciding.',
    escalation
      ? 'Escalate it per /deciding: leave the ticket open, post the escalation draft with the plan and why it escalates, and unclaim it.\nWhy it escalates: ' + escalation
      : 'The plan survived refutation. Post it as the ticket\'s record per wayfinder\'s Reconsideration — the Stands pointers or the Amend text where the plan calls for them — ending with ## Map changes proposed when it has any, then close the ticket and remove the claim.',
    'The plan (' + plan.outcome + '):',
    plan.plan,
    'Return the result in the structured fields.',
  ])
}

async function reconsider(t) {
  let plan = await agent(planPrompt(t, null), { label: 'plan:' + t.ref, phase: 'Resolve', schema: PLAN_SCHEMA, ...tier() })
  if (!plan) return null
  let escalation = plan.escalate ? plan.escalationReason : ''
  if (!escalation) {
    let refute = await agent(refutePrompt(t, plan), { label: 'refute:' + t.ref, phase: 'Refute', schema: REFUTE_SCHEMA, ...tier() })
    if (!refute) refute = { refuted: true, refutation: 'the refuter died; nothing attacked the plan' }
    if (refute.refuted) {
      const revised = await agent(planPrompt(t, { plan, refute }), { label: 'revise:' + t.ref, phase: 'Refute', schema: PLAN_SCHEMA, ...tier() })
      if (!revised) return null
      plan = revised
      escalation = plan.escalate ? plan.escalationReason : ''
      if (!escalation) {
        const again = await agent(refutePrompt(t, plan), { label: 'refute-2:' + t.ref, phase: 'Refute', schema: REFUTE_SCHEMA, ...tier() })
        if (!again || again.refuted) escalation = 'refuted twice: ' + (again ? again.refutation : 'the second refuter died')
      }
    }
  }
  return agent(recordPrompt(t, plan, escalation), { label: 'record:' + t.ref, phase: 'Record', schema: RESULT_SCHEMA, ...tier() })
}

const finished = []
phase('Resolve')
await pipeline(TICKETS, async t => {
  const r = t.type === 'reconsider'
    ? await reconsider(t)
    : await agent(resolvePrompt(t), { label: t.type + ':' + t.ref, phase: 'Resolve', schema: RESULT_SCHEMA, ...tier() })
  const result = r ? { ticket: t.ref, title: t.title, ...r } : STOPPED(t)
  finished.push(result)
  log(t.ref + ' ' + result.status + ': ' + result.gist)
  return result
})

// Finishing order, so the coordinator folds in the order the tickets landed.
return { map: MAP, results: finished }
