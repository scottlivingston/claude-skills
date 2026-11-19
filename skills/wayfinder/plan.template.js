export const meta = {
  name: 'wayfinder-plan',
  description: 'Plan one wayfinder effort: draft the graph of pieces, risks, human tasks and shared decisions from the charter and the code → structural checks → a fresh critic attacks it → one revision → publish it to the effort tracker',
  phases: [
    { title: 'Draft', detail: 'one planner-tier agent checks the charter and drafts the plan as keyed, structured data' },
    { title: 'Check', detail: 'structural checks by script: no cycle, every behavior covered, acceptance on every piece, every cited decision exists, every risk and task blocks a piece, the greenfield skeleton first' },
    { title: 'Critic', detail: 'one fresh planner-tier agent attacks the plan' },
    { title: 'Revise', detail: 'one planner-tier revision from the critic\'s findings and the failed checks, then the checks again' },
    { title: 'Publish', detail: 'executor-tier agents create the decisions, then the pieces, then the risks, tasks, every blocking edge and the plan body' },
  ],
}

// Template for the wayfinder Plan workflow. This file owns every Plan agent's
// prompt; SKILL.md says what Plan is for and LEAD.md what the lead does with
// its return. The planner returns the plan as data keyed so edges can name
// items before they have issue numbers; the script checks the graph, renders
// every issue body, and hands the publishing agents finished text. A plan that
// still fails after its one revision publishes everything the failure doesn't
// touch and returns the gap for the lead to escalate.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes): JSON.stringify or
// Python's json.dumps, spliced in with a plain string replace — a regex
// replacement string turns the \n escapes back into raw newlines and the script
// no longer parses. Nothing goes through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const PLAN = FILL            // the plan issue's number, e.g. 12
const PLAN_TITLE = FILL      // the plan issue's title, verbatim
const REPO_ROOT = FILL       // absolute path of the repo's main checkout — agents run git and WF_CMD from here
const SLUG = FILL            // the effort's slug (wf.py effort prints it)
const EFFORT_BRANCH = FILL   // "effort/<slug>"
const CHARTER = FILL         // the charter's full text, verbatim from docs/wayfinder/<slug>.md on the effort branch
const BEHAVIORS = FILL       // every acceptance behavior in the charter: [{ id: "B1", text: "<the behavior line after the ID, verbatim>" }]
const VERIFY_SKILL = FILL    // the charter's verification line: repo path of the verify-<app> skill, e.g. ".claude/skills/verify-shop/" — "" when the charter says the first foundation piece builds it (greenfield)
const WF_CMD = FILL          // the effort's forge command: "<absolute path of the installed wayfinder skill's wf.py> --effort <slug>"

const EXECUTOR_MODEL = FILL  // per /model-policy: the executor tier's resolved model, or null to inherit
const PLANNER_MODEL = FILL   // per /model-policy: the planner tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the run genuinely deviates ═══════════

const TIER_MODEL = { executor: EXECUTOR_MODEL, planner: PLANNER_MODEL }
const tier = t => (TIER_MODEL[t] ? { model: TIER_MODEL[t] } : {})
const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')

const GREENFIELD = VERIFY_SKILL === ''
const named = (title, n) => title + ' (#' + n + ')'

const CODE_RULE = 'The code as it stands is the local branch ' + EFFORT_BRANCH + ' — there is no remote, so fetch nothing. In ' + REPO_ROOT + ' read it through the branch name — git ls-tree -r --name-only ' + EFFORT_BRANCH + ', git show ' + EFFORT_BRANCH + ':<path>, git grep <pattern> ' + EFFORT_BRANCH + '. Check out nothing and touch no worktree: other workflows of this effort are using them.'

const CONTEXT = j([
  'You are working on a wayfinder effort: agents build it unattended from the charter below, which the human wrote and only the human changes. The plan is issue #' + PLAN + ' (' + PLAN_TITLE + ').',
  'The charter (docs/wayfinder/' + SLUG + '.md):',
  CHARTER,
  CODE_RULE,
])

// /deciding's decision-record format, rendered from DECISION_RECORD. /deciding owns the format;
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

// ── Schemas ──────────────────────────────────────────────────────────────────

// One call per /deciding. Requiring quoted grounds means the agent must open the files it cites.
const DECISION_RECORD = {
  type: 'object', required: ['decision', 'grounds', 'rejected', 'reversal'],
  properties: {
    decision: { type: 'string', description: 'the call, stated so a builder can lift it — snippets where a shape says it better than prose' },
    grounds: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', required: ['kind', 'quote', 'source'],
        properties: {
          kind: { enum: ['principle', 'design', 'rests-on', 'prior-art', 'code'] },
          quote: { type: 'string', description: 'the line it stands on, copied from the file or charter section you opened in this run, never from this brief' },
          source: { type: 'string', description: 'the file path or charter section the quote is from; for a rests-on ground citing another decision of this plan, that decision\'s key' },
        },
      },
    },
    rejected: { type: 'array', items: { type: 'string' }, description: 'each alternative, with the ground it lost on' },
    reversal: { type: 'string', description: '"two-way" or "one-way", then what undoing it would cost once built' },
  },
}

const KEY = { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$', description: 'a short lowercase-hyphen key, unique across every piece, risk, task and decision of the plan' }
const KEYS = d => ({ type: 'array', items: { type: 'string' }, description: d })

const PLAN_DATA = {
  type: 'object', required: ['pieces', 'risks', 'tasks', 'decisions', 'charterGaps', 'whereItStands'],
  properties: {
    pieces: {
      type: 'array', description: 'in plan order: foundations first',
      items: {
        type: 'object', required: ['key', 'title', 'goal', 'acceptance', 'buildsOn', 'needs', 'foundation', 'skeleton'],
        properties: {
          key: KEY,
          title: { type: 'string', description: 'what the piece delivers, as an issue title' },
          goal: { type: 'string', description: 'what this piece delivers, in a paragraph' },
          acceptance: {
            type: 'array', minItems: 1,
            items: {
              type: 'object', required: ['behavior', 'text'],
              properties: {
                behavior: { type: 'string', description: 'the charter behavior ID this line proves, e.g. "B3"; "" for a further criterion' },
                text: { type: 'string', description: 'for a behavior: "<behavior> — <the observable end state that proves it>"; else a criterion an agent can check' },
              },
            },
          },
          buildsOn: KEYS('keys of the shared decisions this piece builds on'),
          needs: KEYS('keys of the pieces whose code this piece needs — only a real code dependency; risks and tasks name what they block themselves'),
          foundation: { type: 'boolean', description: 'other pieces build on this one' },
          skeleton: { type: 'boolean', description: 'this is the walking skeleton plus its verify skill' },
        },
      },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object', required: ['key', 'title', 'question', 'stopCondition', 'blocks'],
        properties: {
          key: KEY, title: { type: 'string' },
          question: { type: 'string', description: 'the question, and the wrong guess it guards against' },
          stopCondition: { type: 'string', description: 'what observation answers it — the spike stops the moment it holds' },
          blocks: KEYS('keys of the pieces that rest on the answer'),
        },
      },
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object', required: ['key', 'title', 'checklist', 'blocks'],
        properties: {
          key: KEY, title: { type: 'string' },
          checklist: { type: 'array', minItems: 1, items: { type: 'string' }, description: 'the exact steps the human performs, one per item, each with what to hand back' },
          blocks: KEYS('keys of the pieces that need its result'),
        },
      },
    },
    decisions: {
      type: 'array', description: 'shared decisions: calls two or more pieces need',
      items: {
        type: 'object', required: ['key', 'title', 'record'],
        properties: { key: KEY, title: { type: 'string', description: 'what it decides, as an issue title' }, record: DECISION_RECORD },
      },
    },
    charterGaps: {
      type: 'array', description: 'what the charter lacks for planning; [] when it is sound',
      items: {
        type: 'object', required: ['gap', 'holds', 'all'],
        properties: {
          gap: { type: 'string', description: 'the section or behavior, quoted, and what is missing from it' },
          holds: KEYS('keys of the items that cannot be published until the human fills the gap'),
          all: { type: 'boolean', description: 'true when no part of the plan can be published until it is filled' },
        },
      },
    },
    whereItStands: { type: 'string', description: 'a short paragraph for the plan body: what is planned, what goes first, what is waiting on whom' },
  },
}

const CRITIC_SCHEMA = {
  type: 'object', required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', required: ['id', 'kind', 'keys', 'finding', 'wastesWork', 'suggestion'],
        properties: {
          id: { type: 'string', description: 'C1, C2, …' },
          kind: { enum: ['too-big', 'missing-edge', 'false-edge', 'not-a-risk', 'missing-risk', 'design-change', 'uncovered', 'other'] },
          keys: KEYS('the keys of the items it concerns'),
          finding: { type: 'string', description: 'what is wrong, citing the charter line or the code (path and quoted line) it is held against' },
          wastesWork: { type: 'boolean', description: 'building the plan as it stands would waste real work — rebuilt code, a piece that cannot land, a wrong guess many pieces rest on' },
          suggestion: { type: 'string', description: 'the smallest change to the plan that answers it' },
        },
      },
    },
  },
}

const REVISE_SCHEMA = {
  type: 'object', required: ['plan', 'resolutions'],
  properties: {
    plan: PLAN_DATA,
    resolutions: {
      type: 'array', description: 'one per critic finding',
      items: {
        type: 'object', required: ['id', 'resolved', 'how'],
        properties: {
          id: { type: 'string' },
          resolved: { type: 'boolean', description: 'false when the finding stands and the plan could not answer it' },
          how: { type: 'string', description: 'what changed in the plan, or why the finding is wrong (citing the line that shows it), or why it cannot be answered without the human' },
        },
      },
    },
  },
}

const CREATED_SCHEMA = {
  type: 'object', required: ['created', 'failed'],
  properties: {
    created: { type: 'array', items: { type: 'object', required: ['key', 'number'], properties: { key: { type: 'string' }, number: { type: 'integer' } } } },
    failed: { type: 'array', items: { type: 'object', required: ['key', 'reason'], properties: { key: { type: 'string' }, reason: { type: 'string' } } } },
  },
}

const FINISH_SCHEMA = {
  type: 'object', required: ['created', 'edgesAdded', 'bodyRewritten', 'failed'],
  properties: {
    created: CREATED_SCHEMA.properties.created,
    edgesAdded: { type: 'integer' },
    bodyRewritten: { type: 'boolean' },
    failed: { type: 'array', items: { type: 'string' }, description: 'every create, edge or edit that did not land, with the error' },
  },
}

// ── Structural checks ────────────────────────────────────────────────────────
// Pure script over the plan graph; steer.template.js carries the same code.
// g: { pieces: [{ id, status: 'open' | 'done', acceptance: [{ behavior, text }], buildsOn: [id], needs: [id], skeleton }],
//      risks: [{ id, blocks: [id] }], tasks: [{ id, blocks: [id] }], decisions: [{ id }] }
// `needs` holds a piece's piece blockers; risks and tasks carry the pieces they block.
// Returns [{ id: 'S<i>', check, problem, refs: [id] }] — [] when the graph passes.

function structuralChecks(g, behaviors, greenfield) {
  const out = []
  const fail = (check, problem, refs) => out.push({ id: 'S' + (out.length + 1), check, problem, refs })
  const pieces = new Map(g.pieces.map(p => [p.id, p]))
  const decisions = new Set(g.decisions.map(d => d.id))
  const open = g.pieces.filter(p => p.status === 'open')

  for (const p of g.pieces) for (const n of p.needs) if (!pieces.has(n)) fail('edges', p.id + ' needs ' + n + ', which is not a piece of the plan', [p.id])
  for (const x of g.risks.concat(g.tasks)) for (const b of x.blocks) if (!pieces.has(b)) fail('edges', x.id + ' blocks ' + b + ', which is not a piece of the plan', [x.id])

  // No cycle among pieces.
  const color = new Map()
  const stack = []
  const visit = id => {
    color.set(id, 1); stack.push(id)
    for (const n of (pieces.get(id) || { needs: [] }).needs) {
      if (!pieces.has(n)) continue
      if (color.get(n) === 1) { const cyc = stack.slice(stack.indexOf(n)); fail('cycle', 'blocking cycle: ' + cyc.concat(n).join(' → '), cyc) }
      else if (!color.get(n)) visit(n)
    }
    stack.pop(); color.set(id, 2)
  }
  for (const p of g.pieces) if (!color.get(p.id)) visit(p.id)

  for (const b of behaviors) {
    if (!g.pieces.some(p => p.acceptance.some(a => a.behavior === b.id))) fail('coverage', b.id + ' ("' + b.text + '") is in no piece\'s Acceptance', [])
  }
  for (const p of open) if (!p.acceptance.length) fail('acceptance', p.id + ' has no Acceptance line', [p.id])
  for (const p of open) for (const d of p.buildsOn) if (!decisions.has(d)) fail('decisions', p.id + ' builds on ' + d + ', which is no decision of the plan', [p.id])
  for (const x of g.risks.concat(g.tasks)) {
    if (!x.blocks.some(b => pieces.has(b) && pieces.get(b).status === 'open')) fail('blocks', x.id + ' blocks no open piece', [x.id])
  }

  // Greenfield: the walking skeleton plus its verify skill goes first, and every other open piece waits on it.
  if (greenfield) {
    const skel = g.pieces.filter(p => p.skeleton)
    if (skel.length !== 1) {
      fail('skeleton', skel.length ? 'more than one piece is marked as the walking skeleton: ' + skel.map(p => p.id).join(', ') : 'greenfield, and no piece builds the walking skeleton plus its verify skill', skel.length ? skel.map(p => p.id) : open.map(p => p.id))
    } else {
      const s = skel[0]
      if (s.needs.some(n => pieces.has(n))) fail('skeleton', s.id + ' is the walking skeleton but waits on another piece', [s.id])
      const reaches = (id, seen = new Set()) => {
        if (id === s.id) return true
        if (seen.has(id)) return false
        seen.add(id)
        return (pieces.get(id) || { needs: [] }).needs.some(n => reaches(n, seen))
      }
      const loose = open.filter(p => p.id !== s.id && !p.needs.some(n => reaches(n)))
      if (loose.length) fail('skeleton', 'these pieces do not wait on the walking skeleton ' + s.id + ', so they cannot verify themselves: ' + loose.map(p => p.id).join(', '), loose.map(p => p.id))
    }
  }
  return out
}

// The graph of a drafted plan: every item keyed, every piece open.
function graphOf(plan) {
  return {
    pieces: plan.pieces.map(p => ({ id: p.key, status: 'open', acceptance: p.acceptance, buildsOn: p.buildsOn, needs: p.needs, skeleton: p.skeleton })),
    risks: plan.risks.map(r => ({ id: r.key, blocks: r.blocks })),
    tasks: plan.tasks.map(t => ({ id: t.key, blocks: t.blocks })),
    decisions: plan.decisions.map(d => ({ id: d.key })),
  }
}

const showChecks = fails => fails.length ? fails.map(f => '- ' + f.id + ' (' + f.check + '): ' + f.problem).join('\n') : '- every check passes'

// ── Prompts ──────────────────────────────────────────────────────────────────

const PLAN_RULES = j([
  'How a wayfinder plan is cut:',
  '- Foundations first: what other pieces build on — a skeleton that runs end to end, the shared types, an interface two parts meet at. They land as real code, never documents.',
  GREENFIELD
    ? '- This effort is greenfield: nothing can be driven yet. The first foundation piece builds a walking skeleton plus its verify-<app> skill per /create-verification-skill, the app taking its port and data directory from the environment so copies can run side by side. Mark it skeleton: true; every other piece needs it, directly or through another piece.'
    : '- The app is driven through ' + VERIFY_SKILL + '; every behavior already has a pending feature file in its feature map.',
  '- Pieces are cut along the design\'s seams, so most need only the foundations and never each other: the graph should be wide. Each is sized to one agent session — one builder reads it cold, builds it, proves its behaviors by driving the app, and opens one change.',
  '- Every piece\'s Acceptance names the charter behaviors it proves, each as "<behavior> — <the observable end state that proves it>", plus any further criterion an agent can check. Every charter behavior is in at least one piece\'s Acceptance.',
  '- An edge exists where one piece needs another\'s code, and where two pieces change the same function: built apart, the second lands as a conflict with the first, so one waits on the other. Two pieces that only touch the same files get no edge.',
  '- A question becomes a risk only when building on a wrong guess would waste real work: the design might not hold up, the platform might not do what the design needs, or the answer would change the shape of many pieces. Everything else is a best guess the builder who needs it makes and records. Each risk blocks only the pieces that rest on its answer.',
  '- A human task is something only the human can do — a credential, an account, a run on hardware agents cannot reach — written as an exact checklist. Start from the charter\'s Limits; add only what the plan reveals.',
  '- A shared decision is a call two or more pieces need, made now so they build against the same thing. A call only one piece needs is left to its builder. Make each per /deciding: grounds quoted from the files you opened, the alternatives it beat, its reversal cost.',
  '- Plan only as far as you can see clearly: the foundations, the pieces visible from the design, and the risks. Steer adds the pieces the landed code makes visible.',
])

function draftPrompt() {
  return j([
    CONTEXT,
    'You are the planner. Load /deciding and /principles, read the governing PRINCIPLES.md files, then read the code as it stands, and draft the plan.',
    'First check the charter: every section of its shape is present (Destination, Acceptance behaviors, Principles, Design, Out of scope, Limits, Delegated), and every behavior names an end state an agent can observe by driving the app. Each failure is a charter gap: say what is missing and which items of your plan it holds back — only the human fills it, so plan everything it does not touch.',
    PLAN_RULES,
    'Give every item a key; edges and Builds on name items by key. Return the plan as data.',
  ])
}

function criticPrompt(plan, fails) {
  return j([
    CONTEXT,
    'You are the critic of a drafted plan. You did not write it. Attack it: read the charter, the code, and the plan, and find what would make building it waste work.',
    PLAN_RULES,
    'Hunt for: pieces too big for one session; missing edges (a piece that needs code no piece it waits on delivers); edges with no real code dependency; risks that are not risks by the test above, and real risks the plan guesses at; calls that are really design changes (they contradict or extend the charter\'s Design, which only the human changes); charter behaviors no piece proves, or proves only in name.',
    'Every finding cites what it is held against — the charter line or the code, quoted. Set wastesWork only when building the plan as it stands would waste real work. Return [] when the plan holds.',
    'Structural checks on the draft:\n' + showChecks(fails),
    'The plan:',
    JSON.stringify(plan),
  ])
}

function revisePrompt(plan, findings, fails) {
  return j([
    CONTEXT,
    'You are the planner, revising your draft once. Answer every critic finding and every failed structural check, then return the whole revised plan. A finding you judge wrong, say why and cite the line that shows it; a finding only the human can answer (a design change, a charter gap), leave unresolved and add it to charterGaps with the items it holds back.',
    'Load /deciding for any decision you add or change.',
    PLAN_RULES,
    'Structural checks on the draft:\n' + showChecks(fails),
    'Critic findings:\n' + JSON.stringify(findings),
    'The draft:',
    JSON.stringify(plan),
  ])
}

const PUBLISH_RULES = j([
  'This effort has no GitHub: its tracker, changes and commit statuses live in a local store reached only through ' + WF_CMD + ' (run it with --help, and <command> --help, before first use). Never read or write the store\'s files directly and never run gh. Labels are /issue-tracker\'s vocabulary. Run it from ' + REPO_ROOT + ', passing each body with --body-file.',
  'A relaunched run may find some of this already done: before creating an issue, look for one already linked to plan #' + PLAN + ' with the same title (a piece of the plan — issue list --parent ' + PLAN + ' --state all — or an issue whose body opens with "Plan: #' + PLAN + '" — issue list --state all --search "Plan: #' + PLAN + '"); reuse it instead of creating a second, and make its body and labels match. An edge or link that already exists counts as made.',
  'Post every body exactly as given. Report every issue number you created or reused, and every operation that failed with its error.',
])

function decisionsPrompt(decisions) {
  return j([
    'You publish the shared decisions of wayfinder plan #' + PLAN + ' (' + PLAN_TITLE + ').',
    PUBLISH_RULES,
    'Create each decision below, in the order given, as an issue labelled wayfinder:decision with the title and body given, and close it once it is created. A body may contain {{key}} tokens: each names a decision earlier in this list — replace it with #<that issue\'s number> before posting.',
    JSON.stringify(decisions),
  ])
}

function piecesPrompt(pieces) {
  return j([
    'You publish the pieces of wayfinder plan #' + PLAN + ' (' + PLAN_TITLE + ').',
    PUBLISH_RULES,
    'Create each piece below, in the order given, as an issue labelled impl with the title and body given, and with --parent ' + PLAN + ', which makes it a piece of the plan and can only be set at create. Plan order is creation order, so create them one at a time, never in parallel.',
    JSON.stringify(pieces),
  ])
}

function finishPrompt(items, edges, map, whereItStands) {
  return j([
    'You finish publishing wayfinder plan #' + PLAN + ' (' + PLAN_TITLE + ').',
    PUBLISH_RULES,
    items.length ? '1. Create each issue below with its title, labels and body. These are linked to the plan by their first line, never created with --parent.\n' + JSON.stringify(items) : '1. No risks or tasks to create.',
    '2. Add every blocking edge below with issue block <blocked> --by <by>: the issue "blocked" is blocked by the issue "by". Edges naming a {{key}} refer to the issues you created in step 1. Edges onto closed decision issues record what rests on them; they block nothing.\n' + JSON.stringify(edges),
    '3. Rewrite the body of plan #' + PLAN + ': keep its first two lines (Effort branch, Charter) and its Destination exactly as they are, replace its behavior map with the map below, and its Where it stands with the text below, keeping the headings it already uses. A {{key}} here also refers to step 1.',
    'Behavior map:\n' + map,
    'Where it stands:\n' + whereItStands,
  ])
}

// ── Draft, check, critic, revise ─────────────────────────────────────────────

phase('Draft')
let plan = await agent(draftPrompt(), { ...tier('planner'), schema: PLAN_DATA, label: 'draft', phase: 'Draft' })
if (!plan) throw new Error('the planner returned nothing; nothing was published')

phase('Check')
let fails = structuralChecks(graphOf(plan), BEHAVIORS, GREENFIELD)
log('Draft: ' + plan.pieces.length + ' pieces, ' + plan.risks.length + ' risks, ' + plan.tasks.length + ' tasks, ' + plan.decisions.length + ' decisions; ' + fails.length + ' structural failures')

phase('Critic')
const critic = await agent(criticPrompt(plan, fails), { ...tier('planner'), schema: CRITIC_SCHEMA, label: 'critic', phase: 'Critic' })
if (!critic) throw new Error('the critic returned nothing; nothing was published')

let unresolved = []
if (critic.findings.length || fails.length) {
  phase('Revise')
  const rev = await agent(revisePrompt(plan, critic.findings, fails), { ...tier('planner'), schema: REVISE_SCHEMA, label: 'revise', phase: 'Revise' })
  if (rev) plan = rev.plan
  const answered = new Map((rev ? rev.resolutions : []).map(r => [r.id, r]))
  // A finding that would waste work stands unless the revision says how it was answered.
  unresolved = critic.findings.filter(f => f.wastesWork && !(answered.get(f.id) && answered.get(f.id).resolved))
    .map(f => ({ ...f, how: answered.get(f.id) ? answered.get(f.id).how : 'the revision did not answer it' }))
  fails = structuralChecks(graphOf(plan), BEHAVIORS, GREENFIELD)
  log('Revised: ' + fails.length + ' structural failures, ' + unresolved.length + ' unresolved critic findings')
}

// ── What the failure touches stays back ──────────────────────────────────────
// Held: every item a charter gap, a failed check, or an unresolved finding names, and every
// piece that waits on a held item or builds on a held decision, transitively.

const holdAll = plan.charterGaps.some(g => g.all)
const held = new Set()
if (holdAll) for (const x of [...plan.pieces, ...plan.risks, ...plan.tasks, ...plan.decisions]) held.add(x.key)
for (const g of plan.charterGaps) g.holds.forEach(k => held.add(k))
for (const f of fails) f.refs.forEach(k => held.add(k))
for (const f of unresolved) f.keys.forEach(k => held.add(k))
for (let grew = true; grew;) {
  grew = false
  for (const p of plan.pieces) {
    if (held.has(p.key)) continue
    const waits = p.needs.concat(p.buildsOn).some(k => held.has(k)) ||
      plan.risks.concat(plan.tasks).some(x => held.has(x.key) && x.blocks.includes(p.key))
    if (waits) { held.add(p.key); grew = true }
  }
}
// A risk or task left blocking nothing published is held with its pieces.
for (const x of plan.risks.concat(plan.tasks)) if (!x.blocks.some(k => !held.has(k))) held.add(x.key)
// A decision no published piece builds on waits for the pieces it serves.
for (const d of plan.decisions) if (!plan.pieces.some(p => !held.has(p.key) && p.buildsOn.includes(d.key))) held.add(d.key)

const gaps = [
  ...plan.charterGaps.map(g => 'Charter gap: ' + g.gap),
  ...fails.map(f => 'Structural check ' + f.check + ' still fails after the revision: ' + f.problem),
  ...unresolved.map(f => 'Critic finding ' + f.id + ' (' + f.kind + ') unresolved: ' + f.finding + ' — ' + f.how),
]
const gap = gaps.length ? j([...gaps, held.size ? 'Held back until it is answered: ' + [...held].join(', ') + '.' : null]) : ''

// ── Publish ──────────────────────────────────────────────────────────────────

phase('Publish')
const num = {} // key → issue number
const take = (res, what) => {
  if (!res) throw new Error('the ' + what + ' agent returned nothing; publishing stopped — a relaunch reuses what landed')
  for (const c of res.created) num[c.key] = c.number
  if (res.failed.length) throw new Error(what + ' failed to publish: ' + JSON.stringify(res.failed) + ' — a relaunch reuses what landed')
}

const pubDecisions = plan.decisions.filter(d => !held.has(d.key))
const titleOf = {}
for (const x of [...plan.pieces, ...plan.risks, ...plan.tasks, ...plan.decisions]) titleOf[x.key] = x.title
const keyed = new Set(pubDecisions.map(d => d.key))
// Rests-on grounds between this plan's decisions: order dependencies first, cite by token.
const restsOn = d => d.record.grounds.filter(g => g.kind === 'rests-on' && keyed.has(g.source)).map(g => g.source)
const ordered = []
const placed = new Set()
const place = (d, seen = new Set()) => {
  if (placed.has(d.key) || seen.has(d.key)) return
  seen.add(d.key)
  for (const k of restsOn(d)) place(pubDecisions.find(x => x.key === k), seen)
  placed.add(d.key); ordered.push(d)
}
pubDecisions.forEach(d => place(d))
if (ordered.length) {
  const items = ordered.map(d => ({
    key: d.key, title: d.title,
    body: 'Plan: #' + PLAN + '\n\n' + renderRecord({ ...d.record, grounds: d.record.grounds.map(g => (keyed.has(g.source) ? { ...g, source: '{{' + g.source + '}} ' + titleOf[g.source] } : g)) }),
  }))
  take(await agent(decisionsPrompt(items), { ...tier('executor'), schema: CREATED_SCHEMA, label: 'publish:decisions', phase: 'Publish' }), 'decisions')
}

const pubPieces = plan.pieces.filter(p => !held.has(p.key))
// SKILL.md's piece body shape.
const pieceBody = p => [
  '## Goal', (p.skeleton ? 'Walking skeleton: ' : '') + p.goal, '',
  '## Acceptance', ...p.acceptance.map(a => '- ' + (a.behavior ? a.behavior + ': ' : '') + a.text), '',
  '## Builds on', ...(p.buildsOn.length ? p.buildsOn.map(k => '- #' + num[k] + ' ' + titleOf[k]) : ['- none']),
].join('\n')
if (pubPieces.length) {
  take(await agent(piecesPrompt(pubPieces.map(p => ({ key: p.key, title: p.title, body: pieceBody(p) }))),
    { ...tier('executor'), schema: CREATED_SCHEMA, label: 'publish:pieces', phase: 'Publish' }), 'pieces')
}

const ref = k => (num[k] ? '#' + num[k] : '{{' + k + '}}')
const blockList = keys => keys.filter(k => num[k]).map(k => '- #' + num[k] + ' ' + titleOf[k])
const pubRisks = plan.risks.filter(r => !held.has(r.key))
const pubTasks = plan.tasks.filter(t => !held.has(t.key))
const items = [
  ...pubRisks.map(r => ({ key: r.key, title: r.title, labels: ['wayfinder:risk', 'afk'],
    body: ['Plan: #' + PLAN, '', '## Question', '', r.question, '', '## Stop when', '', r.stopCondition, '', '## Blocks', '', ...blockList(r.blocks)].join('\n') })),
  ...pubTasks.map(t => ({ key: t.key, title: t.title, labels: ['wayfinder:task', 'hitl'],
    body: ['Plan: #' + PLAN, '', '## What only you can do', '', ...t.checklist.map(c => '- [ ] ' + c), '', '## Unblocks', '', ...blockList(t.blocks)].join('\n') })),
]
const edges = []
for (const p of pubPieces) {
  for (const k of p.needs) if (num[k]) edges.push({ blocked: '#' + num[p.key], by: '#' + num[k] })
  for (const k of p.buildsOn) if (num[k]) edges.push({ blocked: '#' + num[p.key], by: '#' + num[k] })
}
for (const x of pubRisks.concat(pubTasks)) for (const k of x.blocks) if (num[k]) edges.push({ blocked: '#' + num[k], by: ref(x.key) })
for (const d of ordered) for (const k of restsOn(d)) edges.push({ blocked: '#' + num[d.key], by: '#' + num[k] })

const map = BEHAVIORS.map(b => {
  const cover = pubPieces.filter(p => p.acceptance.some(a => a.behavior === b.id))
  return '- **' + b.id + '** ' + b.text + ' — ' + (cover.length ? cover.map(p => named(p.title, num[p.key])).join(', ') : 'not covered yet')
}).join('\n')
const where = j([plan.whereItStands, gap ? 'Waiting on the human: ' + gaps.length + ' gap' + (gaps.length > 1 ? 's' : '') + ' in the charter or the plan, escalated by the lead.' : null])

if (pubPieces.length || items.length) {
  const fin = await agent(finishPrompt(items, edges, map, where), { ...tier('executor'), schema: FINISH_SCHEMA, label: 'publish:edges', phase: 'Publish' })
  if (!fin) throw new Error('the edge and plan-body agent returned nothing; publishing stopped — a relaunch reuses what landed')
  for (const c of fin.created) num[c.key] = c.number
  if (fin.failed.length || !fin.bodyRewritten) throw new Error('publishing did not finish: ' + JSON.stringify(fin.failed) + ' — a relaunch reuses what landed')
}

const listed = xs => xs.filter(x => num[x.key]).map(x => ({ key: x.key, number: num[x.key] }))
log('Plan #' + PLAN + ': published ' + pubPieces.length + ' pieces, ' + pubRisks.length + ' risks, ' + pubTasks.length + ' tasks, ' + ordered.length + ' decisions' + (held.size ? '; ' + held.size + ' held' : ''))
return {
  status: gap ? 'escalate' : 'published',
  pieces: listed(plan.pieces), risks: listed(plan.risks), tasks: listed(plan.tasks), decisions: listed(plan.decisions),
  gap,
}
