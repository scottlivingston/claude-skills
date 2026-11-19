export const meta = {
  name: 'wayfinder-steer',
  description: 'One wayfinder Steer: replan from what landed ∥ cross-read the recent decisions → structural checks → reconsider each strained decision, a fresh refuter on every amend or supersede → apply every op in the effort store → progress and completion by script',
  phases: [
    { title: 'Replan', detail: 'one decider-tier replanner turns defects, parks, landed code and redirects into ops, beside one decider-tier cross-read of the decisions since the last steer' },
    { title: 'Check', detail: 'structural checks by script on the replanned graph; one revision when they fail' },
    { title: 'Reconsider', detail: 'one planner-tier reconsideration per strained decision, each amend or supersede attacked by a fresh planner-tier refuter; over-proved risks weighed for a best guess by decider-tier agents' },
    { title: 'Apply', detail: 'executor-tier agents create decisions, then pieces, risks and tasks, then every edit, unpark, drop, decision outcome and escalation' },
    { title: 'Record', detail: 'one executor-tier agent rewrites the plan body, removes finished worktrees, and posts the steer summary' },
  ],
}

// Template for the wayfinder Steer workflow. This file owns every Steer agent's
// prompt; SKILL.md says what Steer is for and LEAD.md what the lead does with
// its return. The replanner and the reconsiderations return ops as data; the
// script folds them into the plan graph, runs Plan's structural checks on the
// result, holds back what fails them, renders every issue body, and decides
// progress and completion itself.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes): JSON.stringify or
// Python's json.dumps, spliced in with a plain string replace — a regex
// replacement string turns the \n escapes back into raw newlines and the script
// no longer parses. Nothing goes through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const PLAN = FILL              // the plan issue's number, e.g. 12
const PLAN_TITLE = FILL        // the plan issue's title, verbatim
const STEER = FILL             // this steer's number n: one more than the last <!-- wayfinder steer <n> --> on the plan, 1 when there is none
const REPO_ROOT = FILL         // absolute path of the repo's main checkout — agents run git and WF_CMD from here
const SLUG = FILL              // the effort's slug (wf.py effort prints it)
const EFFORT_BRANCH = FILL     // "effort/<slug>"
const EFFORT_HEAD = FILL       // the effort branch's head sha now (wf.py effort prints it)
const CHARTER = FILL           // the charter's full text, verbatim from docs/wayfinder/<slug>.md on the effort branch
const BEHAVIORS = FILL         // every acceptance behavior in the charter: [{ id: "B1", text: "<the behavior line after the ID, verbatim>" }]
const PIECES = FILL            // wf.py pieces, each object extended with body (the issue body, verbatim) and blockedBy
                               // (the numbers of every issue it is blocked by, open or closed: blocked_by in wf.py issue show <n>)
const RISKS = FILL             // the plan's open risks: [{ number, title, labels: [label names], body }] — [] when none
const TASKS = FILL             // the plan's open human tasks: [{ number, title, labels: [label names], body }] — [] when none
const DECISIONS = FILL         // every wayfinder:decision issue of the plan, open or closed: [{ number, title }]
const SKELETON_PIECE = FILL    // greenfield only: the number of the walking-skeleton piece (its Goal opens "Walking skeleton:") while it is not done; null otherwise
const VERIFY = FILL            // the latest <!-- wayfinder verify <sha> --> report on the plan: { sha, proven: ["B1", …] (the behaviors it reports proven), report: "<the comment, verbatim>" } — null when there is none
const PARKED = FILL            // every parked piece: [{ number, title, park: "<its latest <!-- wayfinder park --> comment, verbatim>" }] — [] when none
const RECENT_DECISIONS = FILL  // every decision made since the last steer summary (all of them when there is none): decision issues created, <!-- decision-record --> comments on pieces, spike answers, gap-fills —
                               // [{ ref: "#<n>" for a decision issue or "comment <id> on #<n>" for a record on a piece, issue: <the issue it lives on>, title, text: "<the record, verbatim>" }]
const FRICTION = FILL          // every decision with a <!-- friction --> note since its last <!-- wayfinder reconsider --> comment (since it was made, when it has none):
                               // [{ ref, issue, title, notes: [{ source: "park" | "review" | "spike" | "other" (from the note's From line: a parked piece, a review finding, a spike's best guess, anything else), text: "<the note, verbatim>" }] }] — [] when none
const HUMAN = FILL             // since the last steer summary: [{ kind: "answer" | "redirect", issue, question: "<the escalation or question answered, verbatim; \"\" for a redirect>", text: "<the human's words, verbatim>" }] —
                               // answers to escalations and closed human tasks, and every <!-- wayfinder redirect --> comment on the plan; [] when none
const PREV_STEER = FILL        // the last <!-- wayfinder steer <n> --> summary on the plan, verbatim; "" when there is none
const MERGED_SINCE = FILL      // the count of pieces whose change merged since the last steer summary (since the plan was published, when there is none)
const RISKS_CLOSED_SINCE = FILL // risks closed in the same span
const WF_CMD = FILL            // the effort's forge command: "<absolute path of the installed wayfinder skill's wf.py> --effort <slug>"

const EXECUTOR_MODEL = FILL    // per /model-policy: the executor tier's resolved model, or null to inherit
const DECIDER_MODEL = FILL     // per /model-policy: the decider tier's resolved model, or null to inherit
const PLANNER_MODEL = FILL     // per /model-policy: the planner tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the run genuinely deviates ═══════════

// Replan and the decision review run on every Steer, so they are decider-tier; the planner tier
// is kept for reconsidering a strained decision, which is rare and reworks built code when wrong.
const TIER_MODEL = { executor: EXECUTOR_MODEL, decider: DECIDER_MODEL, planner: PLANNER_MODEL }
const tier = t => (TIER_MODEL[t] ? { model: TIER_MODEL[t] } : {})
const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')

// Nothing has a link: a human reads a title followed by its number.
const named = (title, n) => title + ' (#' + n + ')'
const IN_FLIGHT = ['working', 'in-review', 'landing']
const EDITABLE = ['ready', 'blocked', 'parked']

const CODE_RULE = 'The code as it stands is the local branch ' + EFFORT_BRANCH + '; there is no remote, so fetch nothing. From ' + REPO_ROOT + ' read it by name — git ls-tree -r --name-only ' + EFFORT_BRANCH + ', git show ' + EFFORT_BRANCH + ':<path>, git grep <pattern> ' + EFFORT_BRANCH + ', git log ' + EFFORT_BRANCH + '. Check out nothing and touch no worktree: other workflows of this effort are using them. This effort has no GitHub: its tracker, changes and commit statuses live in a local store reached only through ' + WF_CMD + ' (run it with --help, and <command> --help, before first use). Never read or write the store\'s files directly and never run gh. Read any issue and its comments with ' + WF_CMD + ' issue show <n>, and a change with ' + WF_CMD + ' change show <n>.'

const CONTEXT = j([
  'You are working on a wayfinder effort: agents build it unattended from the charter below, which the human wrote and only the human changes. The plan is issue #' + PLAN + ' (' + PLAN_TITLE + '). This is its steer ' + STEER + ': the plan is kept honest against what landed, and bad calls are caught before more is built on them.',
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
          quote: { type: 'string', description: 'the line it stands on, copied from the file, charter section or issue you opened in this run, never from this brief' },
          source: { type: 'string', description: 'the file path, charter section, or issue (#<n> and title) the quote is from' },
        },
      },
    },
    rejected: { type: 'array', items: { type: 'string' }, description: 'each alternative, with the ground it lost on' },
    reversal: { type: 'string', description: '"two-way" or "one-way", then what undoing it would cost once built' },
  },
}

const KEY = { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$', description: 'a short lowercase-hyphen key for a new item, unique in this steer' }
const REFS = d => ({ type: 'array', items: { type: 'string' }, description: d })
const ACCEPTANCE = {
  type: 'array', minItems: 1,
  items: {
    type: 'object', required: ['behavior', 'text'],
    properties: {
      behavior: { type: 'string', description: 'the charter behavior ID this line proves, e.g. "B3"; "" for a further criterion' },
      text: { type: 'string', description: 'for a behavior: "<behavior> — <the observable end state that proves it>"; else a criterion an agent can check' },
    },
  },
}

const REPLAN_SCHEMA = {
  type: 'object', required: ['decisions', 'pieces', 'risks', 'tasks', 'edits', 'unparks', 'drops', 'whereItStands', 'holdingUp', 'transientCause'],
  properties: {
    decisions: {
      type: 'array', description: 'new shared decisions — calls two or more pieces need',
      items: { type: 'object', required: ['key', 'title', 'record'], properties: { key: KEY, title: { type: 'string' }, record: DECISION_RECORD } },
    },
    pieces: {
      type: 'array', description: 'new pieces, in the order they should build',
      items: {
        type: 'object', required: ['key', 'title', 'goal', 'acceptance', 'buildsOn', 'needs', 'blocks', 'why'],
        properties: {
          key: KEY, title: { type: 'string' },
          goal: { type: 'string', description: 'what this piece delivers, in a paragraph' },
          acceptance: ACCEPTANCE,
          buildsOn: REFS('the decisions it builds on: "#<n>" or a new decision\'s key'),
          needs: REFS('the pieces whose code it needs: "#<n>" or a new piece\'s key'),
          blocks: REFS('existing pieces ("#<n>", ready, blocked or parked) that must now wait on this one'),
          why: { type: 'string', description: 'what made it visible: the defect, the landed code, the redirect, the answer' },
        },
      },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object', required: ['key', 'title', 'question', 'stopCondition', 'blocks'],
        properties: { key: KEY, title: { type: 'string' }, question: { type: 'string' }, stopCondition: { type: 'string' }, blocks: REFS('the pieces that rest on its answer: "#<n>" or a new piece\'s key') },
      },
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object', required: ['key', 'title', 'checklist', 'blocks'],
        properties: { key: KEY, title: { type: 'string' }, checklist: { type: 'array', minItems: 1, items: { type: 'string' } }, blocks: REFS('the pieces that need its result: "#<n>" or a new piece\'s key') },
      },
    },
    edits: {
      type: 'array', description: 'changes to existing ready, blocked or parked pieces',
      items: {
        type: 'object', required: ['ref', 'why', 'set', 'goal', 'acceptance', 'buildsOn', 'needs'],
        properties: {
          ref: { type: 'string', description: '"#<n>"' },
          why: { type: 'string' },
          set: { type: 'array', items: { enum: ['goal', 'acceptance', 'buildsOn', 'needs'] }, description: 'the fields this edit replaces; the others are ignored' },
          goal: { type: 'string' },
          acceptance: { type: 'array', items: ACCEPTANCE.items },
          buildsOn: REFS('the whole new Builds on list'),
          needs: REFS('the whole new list of pieces it waits on — risks and tasks are not listed here'),
        },
      },
    },
    unparks: {
      type: 'array',
      items: {
        type: 'object', required: ['ref', 'gap', 'record'],
        properties: { ref: { type: 'string', description: '"#<n>", a parked piece' }, gap: { type: 'string', description: 'the gap its park named, in a line' }, record: DECISION_RECORD },
      },
    },
    drops: {
      type: 'array', description: 'existing ready, blocked or parked pieces no longer needed, or replaced by a split',
      items: { type: 'object', required: ['ref', 'why'], properties: { ref: { type: 'string' }, why: { type: 'string' } } },
    },
    whereItStands: { type: 'string', description: 'the plan body\'s Where it stands, rewritten: what runs now, what this steer learned and changed, what is next, what waits on the human' },
    holdingUp: { type: 'string', description: 'what is holding the effort up right now and what would move it, in a paragraph — the stall report quotes it' },
    transientCause: { type: 'string', description: 'a transient cause the inputs show for any lack of progress — a dead agent, a flaky suite, a gate that was not running — or ""' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object', required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', required: ['id', 'kind', 'subject', 'other', 'tension', 'newTitle'],
        properties: {
          id: { type: 'string', description: 'T1, T2, …' },
          kind: { enum: ['contradiction', 'broken-input', 'built-around', 'stale-ground', 'over-proving', 'title-drift'] },
          subject: {
            type: 'object', required: ['ref', 'issue', 'title', 'quote'],
            description: 'the side that needs re-deciding: a decision, or for over-proving the risk',
            properties: {
              ref: { type: 'string', description: '"#<n>" for an issue, or "comment <id> on #<n>" for a record on a piece' },
              issue: { type: 'integer', description: 'the issue it lives on' },
              title: { type: 'string' },
              quote: { type: 'string', description: 'the sentence the tension turns on, quoted from it' },
            },
          },
          other: {
            type: 'object', required: ['source', 'quote'],
            description: 'the second side: another decision, a principle, the Design, or the code',
            properties: {
              source: { type: 'string', description: 'the decision (title and ref), the principle file or charter section, or the code path' },
              quote: { type: 'string', description: 'the sentence or line, quoted from it' },
            },
          },
          tension: { type: 'string', description: 'why the two sides cannot both stand, or what the subject got wrong' },
          newTitle: { type: 'string', description: 'title-drift only: the title that says what the decision decides; "" otherwise' },
        },
      },
    },
  },
}

const RECONSIDER_SCHEMA = {
  type: 'object', required: ['verdict', 'why', 'title', 'record', 'dependents', 'reworks', 'escalation'],
  properties: {
    verdict: { enum: ['stands', 'amend', 'supersede'] },
    why: { type: 'string', description: 'stands: why each strain is acceptable, one line per strain; amend or supersede: what the change answers, strain by strain' },
    title: { type: 'string', description: 'supersede: the replacement decision\'s title; "" otherwise' },
    record: { ...DECISION_RECORD, description: 'amend: the amended record; supersede: the replacement; stands: the decision as it stands' },
    dependents: {
      type: 'array', description: 'every piece and decision that rests on it',
      items: {
        type: 'object', required: ['ref', 'title', 'effect', 'built', 'why'],
        properties: {
          ref: { type: 'string', description: '"#<n>"' }, title: { type: 'string' },
          effect: { enum: ['unaffected', 'reworked'] },
          built: { type: 'boolean', description: 'its code has landed or is in an open change' },
          why: { type: 'string' },
        },
      },
    },
    reworks: {
      type: 'array', description: 'supersede: one rework piece per reworked dependent that is built; [] otherwise',
      items: {
        type: 'object', required: ['dependent', 'title', 'goal', 'acceptance', 'blocks'],
        properties: {
          dependent: { type: 'string', description: '"#<n>" of the built dependent it reworks' },
          title: { type: 'string' }, goal: { type: 'string' }, acceptance: ACCEPTANCE,
          blocks: REFS('open pieces ("#<n>") that would build further on the code it reworks'),
        },
      },
    },
    escalation: {
      type: 'object', required: ['case', 'draft'],
      properties: {
        case: { enum: ['none', 'no-grounds', 'one-way', 'changes-inputs'], description: 'which of /deciding\'s three cases the verdict falls in, if any' },
        draft: { type: 'string', description: 'when a case holds: the escalation per /deciding — the question, the options with what each costs, the one you would pick and its ground, written for a cold reader; "" otherwise' },
      },
    },
  },
}

const REFUTE_SCHEMA = {
  type: 'object', required: ['verdict', 'reasons', 'escalationDraft'],
  properties: {
    verdict: { enum: ['holds', 'refuted'] },
    reasons: { type: 'string', description: 'each way the verdict fails, citing the line that shows it; for holds, the strongest attack you tried and why it failed' },
    escalationDraft: { type: 'string', description: 'refuted: the escalation per /deciding a human could answer from alone — the question, the options (this verdict and what you would do instead) with what each costs, the one you would pick and its ground; "" for holds' },
  },
}

const RISK_SCHEMA = {
  type: 'object', required: ['verdict', 'why', 'title', 'record'],
  properties: {
    verdict: { enum: ['keep', 'drop'] },
    why: { type: 'string', description: 'the risk test applied: what a wrong guess would waste, or why it wastes nothing' },
    title: { type: 'string', description: 'drop: the best-guess decision\'s title; "" for keep' },
    record: { ...DECISION_RECORD, description: 'drop: the best guess, per /deciding; keep: the question restated as the decision it waits on' },
  },
}

const CREATED_SCHEMA = {
  type: 'object', required: ['created', 'failed'],
  properties: {
    created: { type: 'array', items: { type: 'object', required: ['key', 'number'], properties: { key: { type: 'string' }, number: { type: 'integer' } } } },
    failed: { type: 'array', items: { type: 'object', required: ['key', 'reason'], properties: { key: { type: 'string' }, reason: { type: 'string' } } } },
  },
}

const DONE_SCHEMA = {
  type: 'object', required: ['done', 'failed'],
  properties: {
    done: { type: 'integer', description: 'how many of the numbered actions landed' },
    failed: { type: 'array', items: { type: 'string' }, description: 'each action that did not land: its number and the error' },
  },
}

// ── Structural checks ────────────────────────────────────────────────────────
// Pure script over the plan graph; plan.template.js carries the same code.
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

const showChecks = fails => fails.length ? fails.map(f => '- ' + f.id + ' (' + f.check + '): ' + f.problem).join('\n') : '- every check passes'

// ── The plan as it stands ────────────────────────────────────────────────────
// Ids are "#<n>" for issues that exist and keys for items this steer creates.

function sectionsOf(body) {
  const out = [{ heading: null, lines: [] }]
  for (const line of (body || '').split('\n')) {
    const h = line.match(/^## (.+?)\s*$/)
    if (h) out.push({ heading: h[1], lines: [] })
    else out[out.length - 1].lines.push(line)
  }
  return out
}
const section = (secs, name) => (secs.find(s => s.heading === name) || { lines: [] }).lines
const parseAcceptance = lines => lines.map(l => l.match(/^- (?:(B\d+):\s*)?(.*\S)/)).filter(Boolean).map(m => ({ behavior: m[1] || '', text: m[2] }))
const parseBuildsOn = lines => lines.map(l => l.match(/^- #(\d+)/)).filter(Boolean).map(m => '#' + m[1])

const pieceState = new Map(PIECES.map(p => ['#' + p.number, p.state]))
const pieceNums = new Set(PIECES.map(p => p.number))
const riskNums = new Set(RISKS.map(r => r.number))
const taskNums = new Set(TASKS.map(t => t.number))
const titleOf = new Map([...PIECES, ...RISKS, ...TASKS, ...DECISIONS].map(x => ['#' + x.number, x.title]))
const sectionsBy = new Map(PIECES.map(p => ['#' + p.number, sectionsOf(p.body)]))

const GRAPH0 = {
  pieces: PIECES.map(p => {
    const secs = sectionsBy.get('#' + p.number)
    return {
      id: '#' + p.number, status: p.state === 'done' ? 'done' : 'open',
      acceptance: parseAcceptance(section(secs, 'Acceptance')), buildsOn: parseBuildsOn(section(secs, 'Builds on')),
      needs: p.blockedBy.filter(n => pieceNums.has(n)).map(n => '#' + n),
      skeleton: p.number === SKELETON_PIECE,
    }
  }),
  risks: RISKS.map(r => ({ id: '#' + r.number, blocks: PIECES.filter(p => p.blockedBy.includes(r.number)).map(p => '#' + p.number) })),
  tasks: TASKS.map(t => ({ id: '#' + t.number, blocks: PIECES.filter(p => p.blockedBy.includes(t.number)).map(p => '#' + p.number) })),
  decisions: DECISIONS.map(d => ({ id: '#' + d.number })),
}
const GREENFIELD = SKELETON_PIECE !== null && SKELETON_PIECE !== undefined

// ── Ops ──────────────────────────────────────────────────────────────────────
// Every change this steer makes is one op. Creates are keyed; the rest name "#<n>".
//   { type: 'decision', key, title, record }            a new decision issue
//   { type: 'piece', key, title, goal, acceptance, buildsOn, needs, blocks }
//   { type: 'risk' | 'task', key, title, … , blocks }
//   { type: 'edit', ref, set: { goal?, acceptance?, buildsOn?, needs? }, swap?: [from, to], why }
//   { type: 'unpark', ref, gap, record }   { type: 'drop', ref, why }
//   { type: 'retitle', issue, title, why }   { type: 'closeRisk', ref, decision, why }
//   { type: 'outcome', target, verdict, why, record, replacement }   { type: 'escalate', target, draft }
// A supersede's or a risk drop's ops share a `group`.

function replanOps(rp) {
  const ops = []
  const skipped = []
  const editable = ref => EDITABLE.includes(pieceState.get(ref))
  for (const d of rp.decisions) ops.push({ type: 'decision', key: d.key, title: d.title, record: d.record })
  for (const p of rp.pieces) {
    const blocks = p.blocks.filter(r => { if (editable(r)) return true; skipped.push('new piece ' + p.key + ' cannot block ' + r + ', which is ' + (pieceState.get(r) || 'not a piece')); return false })
    ops.push({ type: 'piece', key: p.key, title: p.title, goal: p.goal, acceptance: p.acceptance, buildsOn: p.buildsOn, needs: p.needs, blocks, why: p.why })
  }
  for (const r of rp.risks) ops.push({ type: 'risk', ...r })
  for (const t of rp.tasks) ops.push({ type: 'task', ...t })
  for (const e of rp.edits) {
    if (!editable(e.ref)) { skipped.push('edit of ' + e.ref + ' skipped: it is ' + (pieceState.get(e.ref) || 'not a piece of the plan')); continue }
    const set = {}
    for (const f of e.set) set[f] = e[f]
    ops.push({ type: 'edit', ref: e.ref, set, why: e.why })
  }
  for (const u of rp.unparks) {
    if (pieceState.get(u.ref) !== 'parked') { skipped.push('unpark of ' + u.ref + ' skipped: it is ' + (pieceState.get(u.ref) || 'not a piece of the plan')); continue }
    ops.push({ type: 'unpark', ...u })
  }
  for (const d of rp.drops) {
    if (!editable(d.ref)) { skipped.push('drop of ' + d.ref + ' skipped: it is ' + (pieceState.get(d.ref) || 'not a piece of the plan')); continue }
    ops.push({ type: 'drop', ...d })
  }
  return { ops, skipped }
}

// The graph once these ops apply.
function graphWith(ops) {
  const g = JSON.parse(JSON.stringify(GRAPH0))
  const piece = id => g.pieces.find(p => p.id === id)
  for (const o of ops) {
    if (o.type === 'decision') g.decisions.push({ id: o.key })
    else if (o.type === 'piece') {
      g.pieces.push({ id: o.key, status: 'open', acceptance: o.acceptance, buildsOn: o.buildsOn, needs: o.needs, skeleton: false })
      for (const b of o.blocks) { const t = piece(b); if (t && !t.needs.includes(o.key)) t.needs.push(o.key) }
    } else if (o.type === 'risk') g.risks.push({ id: o.key, blocks: o.blocks })
    else if (o.type === 'task') g.tasks.push({ id: o.key, blocks: o.blocks })
    else if (o.type === 'edit') {
      const p = piece(o.ref)
      if (!p) continue
      for (const f of Object.keys(o.set)) p[f] = o.set[f]
      if (o.swap) p.buildsOn = p.buildsOn.filter(d => d !== o.swap[0]).concat(p.buildsOn.includes(o.swap[1]) ? [] : [o.swap[1]])
    } else if (o.type === 'drop') g.pieces = g.pieces.filter(p => p.id !== o.ref)
    else if (o.type === 'closeRisk') g.risks = g.risks.filter(r => r.id !== o.ref)
  }
  return g
}

const opId = o => o.key || o.ref || (o.target && o.target.ref) || ''
const opRefs = o => [
  ...(o.buildsOn || []), ...(o.needs || []), ...(o.blocks || []),
  ...(o.set ? [...(o.set.buildsOn || []), ...(o.set.needs || [])] : []),
  ...(o.swap ? [o.swap[1]] : []), ...(o.decision ? [o.decision] : []), ...(o.replacement ? [o.replacement] : []),
]

// Hold back every op a failure names, every op that rests on a held one, and every op of a
// held op's group (a supersede or a risk drop lands whole or not at all).
function holdBack(ops, fails) {
  const refs = new Set(fails.flatMap(f => f.refs))
  const held = new Set(ops.filter(o => refs.has(opId(o))))
  for (let grew = true; grew;) {
    grew = false
    const heldKeys = new Set([...held].filter(o => o.key).map(o => o.key))
    const heldGroups = new Set([...held].filter(o => o.group).map(o => o.group))
    for (const o of ops) {
      if (held.has(o)) continue
      if (opRefs(o).some(r => heldKeys.has(r)) || (o.group && heldGroups.has(o.group))) { held.add(o); grew = true }
    }
  }
  return { kept: ops.filter(o => !held.has(o)), held: ops.filter(o => held.has(o)) }
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const PLAN_RULES = j([
  'How a wayfinder plan is cut:',
  '- Pieces are cut along the design\'s seams, each sized to one agent session — one builder reads it cold, builds it, proves its behaviors by driving the app, and opens one change — in SKILL.md\'s piece body shape: a Goal, an Acceptance naming the charter behaviors it proves as "<behavior> — <the observable end state that proves it>" plus any further criterion an agent can check, and the decisions it Builds on.',
  '- An edge exists only where one piece needs another\'s code. Two pieces that only touch the same files get no edge.',
  '- A question becomes a risk only when building on a wrong guess would waste real work: the design might not hold up, the platform might not do what the design needs, or the answer would change the shape of many pieces. Everything else is a best guess the builder who needs it makes and records.',
  '- A human task is something only the human can do, written as an exact checklist.',
  '- A shared decision is a call two or more pieces need. Make each per /deciding: grounds quoted from the files you opened, the alternatives it beat, its reversal cost.',
  GREENFIELD ? '- This effort is greenfield and its walking skeleton (#' + SKELETON_PIECE + ') has not landed: every new piece waits on it, directly or through another piece.' : null,
])

const STATE = j([
  'The plan\'s pieces (wf.py pieces, with each body and the numbers of the issues it is blocked by):',
  JSON.stringify(PIECES),
  'Open risks:\n' + (RISKS.length ? JSON.stringify(RISKS) : 'none'),
  'Open human tasks:\n' + (TASKS.length ? JSON.stringify(TASKS) : 'none'),
  'Decision issues:\n' + (DECISIONS.length ? DECISIONS.map(d => '- #' + d.number + ' ' + d.title).join('\n') : 'none'),
])

function replanPrompt(prior, fails) {
  return j([
    CONTEXT,
    'You are the replanner. Load /deciding and /principles, read the governing PRINCIPLES.md files, and read the code as it stands. Then turn what happened since the last steer into ops on the plan, and rewrite its Where it stands.',
    PLAN_RULES,
    STATE,
    VERIFY ? 'The latest Verify report (on ' + VERIFY.sha + (VERIFY.sha === EFFORT_HEAD ? ', the effort branch\'s head' : '; the effort branch has moved on to ' + EFFORT_HEAD) + '):\n' + VERIFY.report : 'No Verify report yet.',
    PARKED.length ? 'Parked pieces, with their park comments:\n' + PARKED.map(p => '### #' + p.number + ' ' + p.title + '\n' + p.park).join('\n\n') : 'No parked pieces.',
    HUMAN.length ? 'From the human since the last steer:\n' + HUMAN.map(h => '### ' + h.kind + ' on #' + h.issue + (h.question ? '\nAnswering:\n' + h.question : '') + '\nThe human:\n' + h.text).join('\n\n') : 'Nothing from the human since the last steer.',
    PREV_STEER ? 'The last steer summary:\n' + PREV_STEER : 'No earlier steer summary.',
    'Since the last steer: ' + MERGED_SINCE + ' pieces merged, ' + RISKS_CLOSED_SINCE + ' risks closed.',
    j([
      'What to turn into ops:',
      '- Defects. Verify filed a defect piece (wayfinder:defect) for each failed behavior; refine its Goal or Acceptance when the report shows more than it says. A defect titled as fixing the harness goes before everything else: add it to the needs of every ready or blocked piece.',
      '- Each parked piece: fill the gap its park names per /deciding and unpark it, with the gap-fill as its record. Where the gap is code no piece delivers, add the piece that does and make the parked one need it. A detail is never a reason to leave it parked.',
      '- Pieces the landed code now makes visible: the next pieces the design calls for, now that what they build on exists.',
      '- Splits (drop the piece, add its parts, and repoint every piece that needed it) and drops (a piece the plan no longer needs — repoint what needed it too).',
      '- Redirects from the human, turned into pieces. A redirect that changes the charter becomes a piece that commits the human\'s change to it, in their words.',
      '- Answers from the human: act on what each settles — a charter gap answered means planning the pieces it held back.',
      '- Edit, drop or unpark only pieces that are ready, blocked or parked; a piece that is working, in review, landing or done is left alone.',
      '- Every charter behavior stays in some open or done piece\'s Acceptance.',
    ]),
    'Refer to existing items as "#<n>" and to new ones by their key. Return [] for any kind of op you have none of.',
    prior ? 'Your first replan failed the structural checks below. Return the whole corrected replan.\nFailures:\n' + showChecks(fails) + '\nYour first replan:\n' + JSON.stringify(prior) : null,
  ])
}

function reviewPrompt() {
  return j([
    CONTEXT,
    'You are the decision review: a cross-read of the decisions made since the last steer, held against each other, the decisions they rest on, the principles (load /principles and read the governing PRINCIPLES.md files, then the charter\'s Principles), the charter\'s Design, and the code. Each piece\'s builder saw only its own call; you read them together, because a call made early and confidently gets quietly built around until much of the code stands on it.',
    'The decisions in scope:',
    RECENT_DECISIONS.length ? RECENT_DECISIONS.map(d => '### ' + d.title + ' (' + d.ref + ', on #' + d.issue + ')\n' + d.text).join('\n\n') : 'none',
    'Read every earlier decision they rest on, and any other decision issue you need, with ' + WF_CMD + ' issue show <n>. Open risks:\n' + (RISKS.length ? RISKS.map(r => '- #' + r.number + ' ' + r.title + (r.labels.includes('in-progress') ? ' (being spiked now)' : '')).join('\n') : 'none'),
    j([
      'Hunt for:',
      '- Contradiction — two decisions that cannot both hold, or code built two ways because two pieces decided the same question differently.',
      '- Broken input — a decision that breaks a principle or bends the Design, recorded as if it did not.',
      '- Built around — a later decision or piece that special-cases, works around, or quietly contradicts an earlier one without a friction note on it.',
      '- Stale ground — a decision resting on a fact a spike, a parked piece, or the code has since disproved.',
      '- Over-proving — an open risk that fails the risk test (building on a wrong guess would waste no real work), or a spike still going after its question was answered.',
      '- Title drift — a decision issue whose title no longer says what its decision decides.',
    ]),
    'Never argue that a decision was the wrong call on its merits alone: every finding has a second side — another decision, a principle, the Design, or the code — and quotes both sides. The subject is the side that needs re-deciding: for a contradiction, the later or less grounded call. Return [] when the decisions hold together.',
  ])
}

function strains(t) {
  return j([
    t.notes.length ? 'Friction notes on it since its last reconsideration:\n' + t.notes.map(n => '- (' + n.source + ') ' + n.text).join('\n') : null,
    t.tensions.length ? 'Tensions the decision review found:\n' + t.tensions.map(f => '- ' + f.id + ' (' + f.kind + '): it says "' + f.subject.quote + '"; ' + f.other.source + ' says "' + f.other.quote + '" — ' + f.tension).join('\n') : null,
  ])
}

function reconsiderPrompt(t, prior) {
  return j([
    CONTEXT,
    'You reconsider one decision of this effort: ' + t.title + ' (' + t.ref + ', on #' + t.issue + '). Load /deciding and read its SKILL.md in full. Read the decision\'s full text, every friction note on it, its dependents — the pieces and decisions that rest on it (per /issue-tracker\'s Dependents, and every piece whose Builds on lists it) — and the code those dependents built.',
    'What strains it:',
    strains(t),
    j([
      'Return one verdict:',
      '- stands — the decision holds; say why each strain is acceptable.',
      '- amend — a clarification no dependent\'s code changes over; give the amended record.',
      '- supersede — a replacement; give its title and record, mark every dependent unaffected or reworked, and give a rework piece for each reworked dependent that is built (its code has landed or is in an open change), blocking the open pieces that would build further on that code. A reworked dependent not yet built takes the new decision as written.',
    ]),
    'Quote each principle, design line, or decision your verdict turns on from the file or issue you read it in. When the verdict falls in one of /deciding\'s three escalation cases, name the case and draft the escalation.',
    prior ? 'Your first verdict was refuted. Answer the refutation — revise the verdict, or keep it and show why each reason fails.\nFirst verdict:\n' + JSON.stringify(prior.verdict) + '\nRefutation:\n' + prior.refutation.reasons : null,
  ])
}

function refutePrompt(t, v) {
  return j([
    CONTEXT,
    'You attack a reconsideration of one decision of this effort: ' + t.title + ' (' + t.ref + ', on #' + t.issue + '). You did not write it. Load /deciding and read its SKILL.md in full; read the decision, its dependents, and the code they built.',
    'What strained it:',
    strains(t),
    'The verdict:',
    JSON.stringify(v),
    'Try to refute it: does it answer every strain; does a dependent marked unaffected in fact change (an amend that is really a supersede); is a rework missing, or one there that nothing needs; does the new call break a principle, the Design, or another decision; does it fall in one of /deciding\'s three escalation cases unflagged. Refuted only on a reason you can cite; otherwise it holds.',
  ])
}

function riskPrompt(r, f) {
  return j([
    CONTEXT,
    'You weigh one open risk the decision review says is over-proved: #' + r.number + ' ' + r.title + '. Load /deciding.',
    r.body,
    'The finding: ' + f.tension + ' (' + f.other.source + ': "' + f.other.quote + '")',
    PLAN_RULES,
    'Apply the risk test. Keep it when building on a wrong guess would waste real work. Otherwise drop it: make the best guess per /deciding — the call the principles and design most plainly imply — and give it a title. The pieces it blocks build on that guess, and the code corrects it later if it was wrong.',
  ])
}

const APPLY_RULES = j([
  'This effort has no GitHub: its tracker, changes and commit statuses live in a local store reached only through ' + WF_CMD + ' (run it with --help, and <command> --help, before first use). Never read or write the store\'s files directly and never run gh. Labels are /issue-tracker\'s vocabulary. Run it from ' + REPO_ROOT + ', and pass every body and comment with --body-file.',
  'A relaunched run may find some of this already done: before creating an issue, look for one already in the store with the same title (' + WF_CMD + ' issue list --state all --search "<title>" — a piece whose parent is #' + PLAN + ', or an issue whose body opens with "Plan: #' + PLAN + '"); reuse it instead of creating a second, and make its body and labels match. An edge or label already in place counts as done.',
  'Post every body and comment exactly as given. A {{key}} token names an issue created earlier in the same list: replace it with #<its number>.',
])

function createPrompt(what, items) {
  return j([
    'You create the new ' + what + ' of steer ' + STEER + ' on wayfinder plan #' + PLAN + ' (' + PLAN_TITLE + ').',
    APPLY_RULES,
    'Create each issue below, in the order given, with its title, labels and body. An item with subIssue true is a piece of the plan: create it with --parent ' + PLAN + ', which can only be set at create; one with close true is closed once created. Report every number you created or reused.',
    JSON.stringify(items),
  ])
}

function mutatePrompt(actions) {
  return j([
    'You apply the changes of steer ' + STEER + ' to wayfinder plan #' + PLAN + ' (' + PLAN_TITLE + ').',
    APPLY_RULES,
    'Load /deciding before posting any escalation: post it per its contract, opening <!-- escalation -->, and switch the issue to hitl (removing afk). A blocking edge is ' + WF_CMD + ' issue block <blocked> --by <blocker>; removing one is --unblock <blocker>. Dropping a piece posts the reason as a comment on it, then closes it with --not-planned.',
    'Apply each numbered action below, in order. Report how many landed and every one that failed, with its number and the error.',
    actions.map((a, i) => (i + 1) + '. ' + a).join('\n\n'),
  ])
}

function recordPrompt(map, where, worktrees, summary) {
  return j([
    'You record steer ' + STEER + ' of wayfinder plan #' + PLAN + ' (' + PLAN_TITLE + '). Run git and ' + WF_CMD + ' from ' + REPO_ROOT + '. This effort has no GitHub: its tracker lives in a local store reached only through ' + WF_CMD + ' (run it with --help, and <command> --help, before first use); never read or write the store\'s files directly and never run gh.',
    '1. Rewrite the body of plan #' + PLAN + ' (' + WF_CMD + ' issue edit ' + PLAN + ' --body-file <file>): keep its first two lines (Effort branch, Charter) and its Destination exactly as they are, replace its behavior map with the map below, and its Where it stands with the text below, keeping the headings it already uses.\nBehavior map:\n' + map + '\nWhere it stands:\n' + where,
    worktrees.length ? '2. Remove each of these worktrees that exists (git worktree remove --force <path>), then git worktree prune. One that is not there counts as removed:\n' + worktrees.map(w => '- ' + w).join('\n') : '2. No worktrees to remove.',
    '3. Post this comment on plan #' + PLAN + ', verbatim:\n' + summary,
    'Report how many of the three steps landed, and every one that failed with its error.',
  ])
}

// ── Replan ∥ decision review ─────────────────────────────────────────────────

phase('Replan')
const [replan0, review] = await parallel([
  () => agent(replanPrompt(null, []), { ...tier('decider'), schema: REPLAN_SCHEMA, label: 'replan', phase: 'Replan' }),
  () => agent(reviewPrompt(), { ...tier('decider'), schema: REVIEW_SCHEMA, label: 'decision-review', phase: 'Replan' }),
])
if (!replan0) throw new Error('the replanner returned nothing; nothing was applied')

phase('Check')
let replan = replan0
let built = replanOps(replan)
let fails = structuralChecks(graphWith(built.ops), BEHAVIORS, GREENFIELD)
if (fails.length) {
  const rev = await agent(replanPrompt(replan, fails), { ...tier('decider'), schema: REPLAN_SCHEMA, label: 'replan:revise', phase: 'Check' })
  if (rev) { replan = rev; built = replanOps(replan); fails = structuralChecks(graphWith(built.ops), BEHAVIORS, GREENFIELD) }
}
log('Steer ' + STEER + ': replan has ' + built.ops.length + ' ops, ' + fails.length + ' structural failures')

// ── Reconsider ───────────────────────────────────────────────────────────────
// A decision is reconsidered when it carries friction from code (a park or a review finding),
// a tension from the decision review, or two other notes since its last reconsideration.

const findings = review ? review.findings : []
const targets = new Map()
const target = (ref, issue, title) => {
  if (!targets.has(ref)) targets.set(ref, { ref, issue, title, notes: [], tensions: [] })
  return targets.get(ref)
}
for (const f of FRICTION) target(f.ref, f.issue, f.title).notes.push(...f.notes)
for (const f of findings) if (['contradiction', 'broken-input', 'built-around', 'stale-ground'].includes(f.kind)) target(f.subject.ref, f.subject.issue, f.subject.title).tensions.push(f)
const due = [...targets.values()].filter(t => t.tensions.length || t.notes.some(n => n.source !== 'other') || t.notes.length >= 2)

const overProved = findings.filter(f => f.kind === 'over-proving')
const riskOf = f => RISKS.find(r => r.number === f.subject.issue)
const weighable = overProved.filter(f => riskOf(f) && !riskOf(f).labels.includes('in-progress'))
const unweighed = overProved.filter(f => !weighable.includes(f))

phase('Reconsider')
// Each settles to stands, amend, supersede, escalate, or none (an agent died: nothing changes,
// its friction stays for the next steer).
async function settle(t) {
  const opts = n => ({ ...tier('planner'), label: n + ':' + t.ref.replace(/^.*\//, ''), phase: 'Reconsider' })
  let v = await agent(reconsiderPrompt(t, null), { ...opts('reconsider'), schema: RECONSIDER_SCHEMA })
  for (let round = 1; ; round++) {
    if (!v) return { t, outcome: 'none' }
    if (v.escalation.case !== 'none') return { t, outcome: 'escalate', v, draft: v.escalation.draft }
    if (v.verdict === 'stands') return { t, outcome: 'stands', v }
    const r = await agent(refutePrompt(t, v), { ...opts('refute'), schema: REFUTE_SCHEMA })
    if (!r) return { t, outcome: 'none' }
    if (r.verdict === 'holds') return { t, outcome: v.verdict, v }
    if (round === 2) return { t, outcome: 'escalate', v, draft: r.escalationDraft || ('Refuted twice: ' + r.reasons) }
    v = await agent(reconsiderPrompt(t, { verdict: v, refutation: r }), { ...opts('reconsider-2'), schema: RECONSIDER_SCHEMA })
  }
}
const [settled, weighed] = await parallel([
  () => parallel(due.map(t => () => settle(t))),
  () => parallel(weighable.map(f => () => agent(riskPrompt(riskOf(f), f), { ...tier('decider'), schema: RISK_SCHEMA, label: 'risk:' + f.subject.issue, phase: 'Reconsider' }).then(w => ({ f, w })))),
])

// Decision outcomes as ops.
const outcomeOps = []
settled.forEach((s, i) => {
  if (s.outcome === 'none') return
  if (s.outcome === 'escalate') { outcomeOps.push({ type: 'escalate', target: s.t, draft: s.draft }); return }
  if (s.outcome !== 'supersede') { outcomeOps.push({ type: 'outcome', target: s.t, verdict: s.outcome, why: s.v.why, record: s.v.record }); return }
  const key = 'supersede-' + (i + 1)
  const group = key
  outcomeOps.push({ type: 'decision', key, title: s.v.title, record: s.v.record, group })
  for (const d of s.v.dependents.filter(d => d.effect === 'reworked')) {
    const built = d.built || pieceState.get(d.ref) === 'done' || IN_FLIGHT.includes(pieceState.get(d.ref))
    if (!built && EDITABLE.includes(pieceState.get(d.ref))) outcomeOps.push({ type: 'edit', ref: d.ref, set: {}, swap: [s.t.ref, key], why: 'builds on the decision that supersedes ' + s.t.title, group })
  }
  s.v.reworks.forEach((r, k) => outcomeOps.push({
    type: 'piece', key: key + '-rework-' + (k + 1), title: r.title, goal: r.goal, acceptance: r.acceptance,
    buildsOn: [key], needs: [], blocks: r.blocks.filter(b => EDITABLE.includes(pieceState.get(b))), why: 'reworks ' + r.dependent + ' for ' + s.v.title, group,
  }))
  outcomeOps.push({ type: 'outcome', target: s.t, verdict: 'supersede', why: s.v.why, record: s.v.record, replacement: key, group })
})
weighed.forEach(({ f, w }, i) => {
  if (!w || w.verdict !== 'drop') return
  const key = 'best-guess-' + (i + 1)
  const group = key
  const r = riskOf(f)
  outcomeOps.push({ type: 'decision', key, title: w.title, record: w.record, group })
  for (const b of GRAPH0.risks.find(x => x.id === '#' + r.number).blocks) {
    if (EDITABLE.includes(pieceState.get(b))) outcomeOps.push({ type: 'edit', ref: b, set: {}, swap: [null, key], why: 'builds on the best guess that closes #' + r.number, group })
  }
  outcomeOps.push({ type: 'closeRisk', ref: '#' + r.number, decision: key, why: w.why, group })
})
for (const f of findings.filter(f => f.kind === 'title-drift' && f.newTitle)) outcomeOps.push({ type: 'retitle', issue: f.subject.issue, title: f.newTitle, why: f.tension })

// ── Final graph, held ops, progress ──────────────────────────────────────────

const allOps = built.ops.concat(outcomeOps)
const finalFails = structuralChecks(graphWith(allOps), BEHAVIORS, GREENFIELD)
const { kept, held } = holdBack(allOps, finalFails)
const g = graphWith(kept)

const openPieces = g.pieces.filter(p => p.status === 'open')
const proven = VERIFY ? VERIFY.proven : []
const complete = !!VERIFY && VERIFY.sha === EFFORT_HEAD && BEHAVIORS.every(b => proven.includes(b.id)) && openPieces.length === 0 && g.risks.length === 0
const inFlight = PIECES.some(p => IN_FLIGHT.includes(p.state)) || RISKS.some(r => r.labels.includes('in-progress'))
const retires = kept.some(o => o.type === 'closeRisk')
const stalled = !complete && MERGED_SINCE === 0 && RISKS_CLOSED_SINCE === 0 && !retires && !inFlight && !replan.transientCause
const status = complete ? 'complete' : stalled ? 'stalled' : 'continue'

// ── Apply ────────────────────────────────────────────────────────────────────

phase('Apply')
const num = {} // key → issue number
const take = (res, what) => {
  if (!res) throw new Error('the ' + what + ' agent returned nothing; applying stopped — a relaunch reuses what landed')
  for (const c of res.created) num[c.key] = c.number
  if (res.failed.length) throw new Error(what + ' failed to land: ' + JSON.stringify(res.failed) + ' — a relaunch reuses what landed')
}
const ref = id => (id && id.startsWith('#') ? id : num[id] ? '#' + num[id] : '{{' + id + '}}')
const keyTitle = new Map(kept.filter(o => o.key).map(o => [o.key, o.title]))
const titled = id => ref(id) + ' ' + (id.startsWith('#') ? titleOf.get(id) || '' : keyTitle.get(id) || '')

const newDecisions = kept.filter(o => o.type === 'decision')
if (newDecisions.length) {
  take(await agent(createPrompt('decisions', newDecisions.map(d => ({
    key: d.key, title: d.title, labels: ['wayfinder:decision'], subIssue: false, close: true, body: 'Plan: #' + PLAN + '\n\n' + renderRecord(d.record),
  }))), { ...tier('executor'), schema: CREATED_SCHEMA, label: 'apply:decisions', phase: 'Apply' }), 'decision')
}

// SKILL.md's piece body shape.
const renderAcceptance = acc => acc.map(a => '- ' + (a.behavior ? a.behavior + ': ' : '') + a.text)
const renderBuildsOn = ids => (ids.length ? ids.map(d => '- ' + titled(d)) : ['- none'])
const pieceBody = p => ['## Goal', p.goal, '', '## Acceptance', ...renderAcceptance(p.acceptance), '', '## Builds on', ...renderBuildsOn(p.buildsOn)].join('\n')
const blockList = ids => ids.map(b => '- ' + titled(b))
const created = [
  ...kept.filter(o => o.type === 'piece').map(p => ({ key: p.key, title: p.title, labels: ['impl'], subIssue: true, close: false, body: pieceBody(p) })),
  ...kept.filter(o => o.type === 'risk').map(r => ({ key: r.key, title: r.title, labels: ['wayfinder:risk', 'afk'], subIssue: false, close: false,
    body: ['Plan: #' + PLAN, '', '## Question', '', r.question, '', '## Stop when', '', r.stopCondition, '', '## Blocks', '', ...blockList(r.blocks)].join('\n') })),
  ...kept.filter(o => o.type === 'task').map(t => ({ key: t.key, title: t.title, labels: ['wayfinder:task', 'hitl'], subIssue: false, close: false,
    body: ['Plan: #' + PLAN, '', '## What only you can do', '', ...t.checklist.map(c => '- [ ] ' + c), '', '## Unblocks', '', ...blockList(t.blocks)].join('\n') })),
]
if (created.length) {
  take(await agent(createPrompt('pieces, risks and tasks', created), { ...tier('executor'), schema: CREATED_SCHEMA, label: 'apply:create', phase: 'Apply' }), 'piece, risk and task')
}

// Everything else, as numbered actions in a safe order: edges and bodies before unparks
// (an unparked piece is ready at once), outcomes and escalations last.
const actions = []
const edge = (blocked, by, add) => (add ? 'Add a blocking edge: ' + ref(blocked) + ' is blocked by ' + ref(by) + '.' : 'Remove the blocking edge: ' + ref(blocked) + ' is no longer blocked by ' + ref(by) + '.')
for (const o of kept.filter(o => o.type === 'piece')) {
  for (const n of o.needs.concat(o.buildsOn)) actions.push(edge(o.key, n, true))
  for (const b of o.blocks) actions.push(edge(b, o.key, true))
}
for (const o of kept.filter(o => o.type === 'risk' || o.type === 'task')) for (const b of o.blocks) actions.push(edge(b, o.key, true))
for (const o of newDecisions) for (const gr of o.record.grounds) { const m = gr.kind === 'rests-on' && !/comment \d+ on #/.test(gr.source) && gr.source.match(/#(\d+)/); if (m) actions.push(edge(o.key, '#' + m[1], true)) }

const edited = [...new Set(kept.filter(o => o.type === 'edit').map(o => o.ref))]
for (const id of edited) {
  const before = GRAPH0.pieces.find(p => p.id === id)
  const after = g.pieces.find(p => p.id === id)
  if (!before || !after) continue
  const changed = f => JSON.stringify(before[f]) !== JSON.stringify(after[f])
  const secs = sectionsBy.get(id).map(s => ({ ...s }))
  const put = (name, lines) => { const s = secs.find(x => x.heading === name); if (s) s.lines = lines.concat(['']); else secs.push({ heading: name, lines: lines.concat(['']) }) }
  const op = kept.find(o => o.type === 'edit' && o.ref === id && o.set.goal !== undefined)
  if (op) put('Goal', [op.set.goal])
  if (changed('acceptance')) put('Acceptance', renderAcceptance(after.acceptance))
  if (changed('buildsOn')) put('Builds on', renderBuildsOn(after.buildsOn))
  const body = secs.map(s => (s.heading === null ? s.lines : ['## ' + s.heading, ...s.lines]).join('\n')).join('\n').trim()
  const whys = kept.filter(o => o.type === 'edit' && o.ref === id).map(o => o.why).join('; ')
  actions.push('Replace the body of ' + id + ' (' + whys + ') with:\n' + body)
  for (const n of after.needs.filter(n => !before.needs.includes(n))) actions.push(edge(id, n, true))
  for (const n of before.needs.filter(n => !after.needs.includes(n))) actions.push(edge(id, n, false))
  for (const d of after.buildsOn.filter(d => !before.buildsOn.includes(d))) actions.push(edge(id, d, true))
  for (const d of before.buildsOn.filter(d => !after.buildsOn.includes(d))) actions.push(edge(id, d, false))
}
for (const o of kept.filter(o => o.type === 'drop')) actions.push('Drop ' + o.ref + ': close it as not planned with the comment "Dropped at steer ' + STEER + ': ' + o.why + '".')
for (const o of kept.filter(o => o.type === 'unpark')) actions.push('Unpark ' + o.ref + ': post this gap-fill record as a comment on it, verbatim, then remove its wayfinder:parked label.\n' + renderRecord(o.record))
for (const o of kept.filter(o => o.type === 'closeRisk')) actions.push('Close risk ' + o.ref + ' with the comment "Closed at steer ' + STEER + ' without a spike: ' + o.why + ' — the best guess is ' + ref(o.decision) + '."')
for (const o of kept.filter(o => o.type === 'retitle')) actions.push('Retitle #' + o.issue + ' to "' + o.title + '" (' + o.why + ').')
const reconsiderNote = (o, verdict, extra) => '<!-- wayfinder reconsider ' + STEER + ' -->\n**' + verdict + '** at steer ' + STEER + (extra ? ' — ' + extra : '') + '\n\n' + o.why
for (const o of kept.filter(o => o.type === 'outcome')) {
  const t = o.target
  const onIssue = t.ref.startsWith('#')
  if (o.verdict === 'amend') {
    actions.push(onIssue
      ? 'Amend decision ' + t.ref + ': replace its body with this, verbatim:\nPlan: #' + PLAN + '\n\n' + renderRecord(o.record)
      : 'Amend the decision record at ' + t.ref + ': post this as a new comment on #' + t.issue + ', verbatim:\n' + renderRecord(o.record) + '\n\nAmends ' + t.ref)
  }
  const extra = o.verdict === 'supersede' ? 'superseded by ' + ref(o.replacement) : ''
  actions.push('Post this comment on #' + t.issue + ', verbatim, then remove its friction label if it has one:\n' + reconsiderNote(o, o.verdict, extra) + (onIssue ? '' : '\n\nConcerns the record at ' + t.ref))
}
// An escalation is a reconsideration's outcome too, so the same friction does not escalate again next steer.
for (const o of kept.filter(o => o.type === 'escalate')) {
  actions.push('Post this comment on #' + o.target.issue + ', verbatim, then remove its friction label if it has one:\n<!-- wayfinder reconsider ' + STEER + ' -->\n**escalated** at steer ' + STEER + ' — the human decides; their answer is recorded as a decision.' + (o.target.ref.startsWith('#') ? '' : '\n\nConcerns the record at ' + o.target.ref))
  actions.push('Escalate the decision ' + o.target.title + ' (' + o.target.ref + ') on #' + o.target.issue + ' with this draft, verbatim:\n' + o.draft)
}

const steps = [...new Set(actions)]
let applyFailed = []
if (steps.length) {
  const res = await agent(mutatePrompt(steps), { ...tier('executor'), schema: DONE_SCHEMA, label: 'apply:changes', phase: 'Apply' })
  if (!res) throw new Error('the apply agent returned nothing; the plan may be partly changed — a relaunch replans from what landed')
  applyFailed = res.failed
}

// ── Record ───────────────────────────────────────────────────────────────────

phase('Record')
const pieceTitle = id => (id.startsWith('#') ? titleOf.get(id) : keyTitle.get(id))
const pieceNum = id => (id.startsWith('#') ? Number(id.slice(1)) : num[id])
const map = BEHAVIORS.map(b => {
  const cover = g.pieces.filter(p => p.acceptance.some(a => a.behavior === b.id) && pieceNum(p.id))
  const state = proven.includes(b.id) ? ' (proven on ' + VERIFY.sha.slice(0, 7) + ')' : ''
  return '- **' + b.id + '** ' + b.text + state + ' — ' + (cover.length ? cover.map(p => named(pieceTitle(p.id), pieceNum(p.id))).join(', ') : 'not covered yet')
}).join('\n')

const unparked = new Set(kept.filter(o => o.type === 'unpark').map(o => o.ref))
const wt = REPO_ROOT + '/.claude/worktrees/' + SLUG + '/'
const worktrees = [
  ...PIECES.filter(p => p.state === 'done').flatMap(p => [wt + 'piece-' + p.number, ...(p.change ? [wt + 'review-' + p.change] : [])]),
  ...PIECES.filter(p => p.state === 'parked' && !unparked.has('#' + p.number)).map(p => wt + 'piece-' + p.number),
]

const escalated = kept.filter(o => o.type === 'escalate').map(o => '#' + o.target.issue)
const count = t => kept.filter(o => o.type === t).length
const verdicts = kept.filter(o => o.type === 'outcome').map(o => '- ' + o.target.title + ' (' + o.target.ref + '): ' + o.verdict + (o.replacement ? ', superseded by ' + ref(o.replacement) : '') + ' — ' + o.why.split('\n')[0])
const describe = o => {
  if (o.key) return o.type + ' ' + (o.title || o.key) + (o.why ? ' — ' + o.why : '')
  if (o.type === 'escalate') return 'escalation on ' + o.target.title
  if (o.type === 'retitle') return 'retitle of #' + o.issue
  if (o.type === 'outcome') return o.verdict + ' of ' + o.target.title
  return o.type + ' ' + o.ref
}

const stallReport = stalled ? j([
  'Steer ' + STEER + ' found no progress since the last steer: no piece merged, no risk closed, and nothing is building or being spiked.',
  replan.holdingUp,
  PARKED.length ? 'Parked: ' + PARKED.map(p => named(p.title, p.number)).join(', ') + '.' : null,
  TASKS.length ? 'Waiting on the human: ' + TASKS.map(t => named(t.title, t.number)).join(', ') + '.' : null,
]) : ''

const summary = [
  '<!-- wayfinder steer ' + STEER + ' -->',
  '## Steer ' + STEER + ': ' + status,
  '',
  replan.whereItStands,
  '',
  'Since the last steer: ' + MERGED_SINCE + ' merged, ' + RISKS_CLOSED_SINCE + ' risks closed.' + (VERIFY ? ' Latest Verify on ' + VERIFY.sha.slice(0, 7) + ': ' + proven.length + ' of ' + BEHAVIORS.length + ' behaviors proven.' : ''),
  '',
  '### Changes',
  '- Pieces: ' + count('piece') + ' added, ' + edited.length + ' edited, ' + count('unpark') + ' unparked, ' + count('drop') + ' dropped. Risks: ' + count('risk') + ' added, ' + count('closeRisk') + ' closed on a best guess. Tasks: ' + count('task') + ' added. Decisions: ' + count('decision') + ' published, ' + count('retitle') + ' retitled.',
  ...kept.filter(o => o.key && o.type !== 'decision').map(o => '- Added ' + named(o.title, num[o.key]) + ' — ' + (o.why || o.type)),
  ...kept.filter(o => o.type === 'unpark').map(o => '- Unparked ' + o.ref + ': ' + o.gap),
  ...kept.filter(o => o.type === 'drop').map(o => '- Dropped ' + o.ref + ': ' + o.why),
  '',
  '### Decisions',
  findings.length ? '- The decision review raised ' + findings.length + ': ' + findings.map(f => f.id + ' ' + f.kind + ' on ' + f.subject.title).join('; ') + '.' : '- The decision review raised nothing.',
  ...(verdicts.length ? verdicts : ['- No decision was reconsidered.']),
  ...escalated.map(e => '- Escalated on ' + e + '.'),
  ...settled.filter(s => s.outcome === 'none').map(s => '- ' + s.t.title + ' (' + s.t.ref + '): reconsideration did not finish; its friction carries to the next steer.'),
  ...unweighed.map(f => '- ' + f.subject.title + ': over-proving left alone, its spike is running — ' + f.tension),
  '',
  held.length || finalFails.length || built.skipped.length || applyFailed.length ? '### Held back' : null,
  ...finalFails.map(f => '- Structural check ' + f.check + ': ' + f.problem),
  ...held.map(o => '- Held: ' + describe(o)),
  ...built.skipped.map(s => '- Skipped: ' + s),
  ...applyFailed.map(s => '- Failed to apply: ' + s),
  stallReport ? '\n### Stall\n' + stallReport : null,
].filter(s => s !== null && s !== undefined).join('\n')

const rec = await agent(recordPrompt(map, replan.whereItStands, worktrees, summary), { ...tier('executor'), schema: DONE_SCHEMA, label: 'record', phase: 'Record' })
if (!rec) throw new Error('the record agent returned nothing; the plan body and the steer summary were not posted — a relaunch replans from what landed')

log('Steer ' + STEER + ': ' + status + '; ' + kept.length + ' ops applied, ' + held.length + ' held, ' + escalated.length + ' escalated')
return {
  status,
  applied: { added: count('piece'), edited: edited.length, unparked: count('unpark'), dropped: count('drop'), risks: count('risk'), tasks: count('task'), decisions: count('decision'), reconsidered: verdicts.length, held: held.length, failed: applyFailed.length + rec.failed.length },
  escalations: escalated,
  stallReport,
}
