export const meta = {
  name: 'wayfinder-spike',
  description: 'Prove one wayfinder risk: the cheapest experiment that settles it → one narrower retry → a flagged best guess → the answer published as a decision, or an escalation when it breaks the design',
  phases: [
    { title: 'Spike', detail: 'one decider-tier spiker answers the risk by lookup or throwaway prototype, stopping at its stop condition; one narrower retry when it can\'t' },
    { title: 'Guess', detail: 'only when both spikes came back empty: one decider-tier best guess per /deciding, flagged for Steer' },
    { title: 'Record', detail: 'one executor-tier agent publishes the decision and closes the risk, or escalates it; removes the spike worktree' },
  ],
}

// Template for a wayfinder Prove workflow: one risk, answered by the cheapest
// experiment that settles it and recorded as a decision the pieces it blocked can
// build on. Its code never merges; what it made is committed to a spike branch so
// the evidence outlives the worktree. This file owns every spike agent's prompt;
// SKILL.md and LEAD.md say what the stage is for and what the lead does with the
// return.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes): JSON.stringify or
// Python's json.dumps, spliced in with a plain string replace — a regex
// replacement string turns the \n escapes back into raw newlines and the script
// no longer parses. Nothing goes through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const PLAN_REF = FILL        // the plan issue as "#<n>", e.g. "#12"
const RISK = FILL            // { number: 31, title: "the risk issue's title", body: "the risk issue's body verbatim — its question, stop condition, and blocked pieces" }
const BLOCKED = FILL         // the pieces this risk blocks, the issues under `blocks` in `sc issue view <risk> --json`: [{ number: 40, title: "..." }] — [] if none
const CHARTER_PATH = FILL    // the plan body's Charter: line, e.g. "docs/wayfinder/<slug>.md"
const SLUG = FILL            // the effort's slug — `effort.py show` prints it
const EFFORT_BRANCH = FILL   // the plan body's Effort branch: line, e.g. "effort/<slug>"
const REPO_ROOT = FILL       // absolute path of the main checkout of the repo
const WORKTREE = FILL        // absolute path of this risk's worktree: <REPO_ROOT>/.claude/worktrees/<slug>/spike-<risk number>
const VERIFY_SKILL = FILL    // repo path of the verify-<app> skill the charter's verification line names, e.g. ".claude/skills/verify-web" — "" when the charter says a foundation piece will build it
const AWAIT_CMD = FILL       // absolute path of the installed wayfinder skill's await.sh

const EXECUTOR_MODEL = FILL  // per /model-policy: the executor tier's resolved model, or null to inherit
const DECIDER_MODEL = FILL   // per /model-policy: the decider tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the run genuinely deviates ═══════════

const TIER_MODEL = { executor: EXECUTOR_MODEL, decider: DECIDER_MODEL }
const tier = t => (TIER_MODEL[t] ? { model: TIER_MODEL[t] } : {})
const j = lines => lines.filter(s => s !== null && s !== undefined && s !== '').join('\n')

const SPIKE_BRANCH = 'spike/' + SLUG + '/' + RISK.number
const APP = VERIFY_SKILL ? VERIFY_SKILL.split('/').filter(Boolean).pop().replace(/^verify-/, '') : ''

const CONTEXT = j([
  'You are an agent of a wayfinder effort: a build too big for one session, run unattended by agents from a charter the human wrote. The plan is issue ' + PLAN_REF + '; the charter is ' + CHARTER_PATH + ' on ' + EFFORT_BRANCH + ' — read its Destination, Principles, Design, and Out of scope before anything else. Agents decide the details per /deciding; only the human changes the charter.',
  'The risk you are answering, issue #' + RISK.number + ' "' + RISK.title + '":',
  RISK.body,
  BLOCKED.length ? 'The pieces it blocks: ' + BLOCKED.map(p => '#' + p.number + ' "' + p.title + '"').join(', ') + '. Read each one\'s issue.' : 'It blocks no piece yet.',
])

// A workflow agent's turn ending is its final report, so it waits on a long run in the
// foreground, through await.sh, never on a completion notice.
const BUILD_SLOTS_RULE = 'Run every build and test command — compiles, test suites, anything from the repo\'s test recipes — through the host\'s build pool: sc run --pool build -- <command>. It waits for a free slot, then runs the command and exits with its status. sc starts the command directly, with no shell, so wrap a pipeline or an && chain as sh -c "..."; exit 201 (the worktree changed while it waited) or 202 (the same command was queued again from this directory) means run it again. Run it in the foreground with the Bash timeout at its 600000 ms maximum. One that can outlast that: start it with run_in_background as <the sc run command>; echo "exit: $?" — then wait for it in the foreground with sh ' + AWAIT_CMD + ' <its output file>, which returns within nine minutes saying finished or still running; call it again until it says finished. Never end your turn to wait: your turn ending is your final report, and it stops the run. A run you have not seen finish has no result yet.'
const DRIVE_SLOTS_RULE = APP
  ? 'Start every copy of the app through the host\'s drive slots: sc run --pool drive-' + APP + ' -- <the launch command>, run with run_in_background, so the slot is held exactly as long as the app runs; stop the app when you are done with it, which frees the slot. A copy started this way outlives the shell that started it: when it is still running after you stopped it, end it with sc job cancel <the job id sc run printed>. Where the app has no long-lived process, run each command that exercises it through the drive slots instead.'
  : null

// /deciding's decision-record format, rendered from DECISION_ITEM. /deciding owns the format;
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

const DECISION_ITEM = {
  type: 'object', required: ['title', 'decision', 'grounds', 'rejected', 'reversal'],
  properties: {
    title: { type: 'string', description: 'the decision as a short issue title, in the domain\'s words' },
    decision: { type: 'string', description: 'the answer, stated so a piece can build on it — snippets where a shape says it better than prose' },
    grounds: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', required: ['kind', 'quote', 'source'],
        properties: {
          kind: { enum: ['principle', 'design', 'rests-on', 'prior-art', 'code'] },
          quote: { type: 'string', description: 'the line it stands on, copied from the source you opened in this run, never from this brief' },
          source: { type: 'string', description: 'where the quote is from: a link for a lookup, a file on ' + SPIKE_BRANCH + ' for a prototype, a charter section, an issue' },
        },
      },
    },
    rejected: { type: 'array', items: { type: 'string' }, description: 'each alternative, with the ground it lost on' },
    reversal: { type: 'string', description: '"two-way" or "one-way", then what undoing it would cost once built' },
  },
}

const ANSWER_FIELDS = {
  answered: { type: 'boolean', description: 'true only when the risk\'s stop condition is met' },
  summary: { type: 'string', description: 'what you did and what you found, in a few lines — when not answered, what you learned and why it did not settle' },
  narrower: { type: 'string', description: 'when not answered: the narrower question that would settle the risk; "" otherwise' },
  evidence: { type: 'array', items: { type: 'object', required: ['what', 'where'], properties: { what: { type: 'string' }, where: { type: 'string', description: 'a link, or a path on ' + SPIKE_BRANCH } } } },
  pieces: {
    type: 'array', description: 'one entry per blocked piece; [] when not answered',
    items: { type: 'object', required: ['number', 'effect', 'note'], properties: {
      number: { type: 'integer' },
      effect: { enum: ['unblocked', 'changed'], description: 'unblocked = buildable as written on this answer; changed = its Goal or Acceptance needs rework' },
      note: { type: 'string', description: 'what the answer means for this piece; for changed, exactly what must change' },
    } },
  },
  designHolds: { type: 'boolean', description: 'false when building on the answer needs a part, interface, or flow the charter\'s Design lacks, or contradicts a principle' },
  designBreak: { type: 'string', description: 'when the design breaks: which Design or Principles line, quoted, and how the answer breaks it; "" otherwise' },
  escalation: { enum: ['none', 'no-grounds', 'one-way'], description: 'per /deciding\'s escalation cases other than a changed input (a changed input is designHolds=false)' },
  escalationDraft: { type: 'string', description: 'when designHolds=false or escalation is not none: the escalation per /deciding — the question, the options with what each costs, the one you would pick and its ground — written per /hitl-questions\' cold-reader rules; "" otherwise' },
  record: DECISION_ITEM,
}
const ANSWER_SCHEMA = { type: 'object', required: Object.keys(ANSWER_FIELDS), properties: ANSWER_FIELDS }

const RECORD_SCHEMA = {
  type: 'object', required: ['decision', 'riskClosed', 'problems'],
  properties: {
    decision: { type: 'integer', description: 'the decision issue\'s number; 0 when none was published' },
    riskClosed: { type: 'boolean' },
    problems: { type: 'string', description: 'any step you could not complete, and why; "" when every step landed' },
  },
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const WORKTREE_RULE = 'Work in ' + WORKTREE + ' on branch ' + SPIKE_BRANCH + '. If it does not exist, create it from ' + REPO_ROOT + ' with git worktree add -b ' + SPIKE_BRANCH + ' ' + WORKTREE + ' ' + EFFORT_BRANCH + ' — there is no remote, so fetch and push nothing, and never check out, commit to or move ' + EFFORT_BRANCH + ' itself. If it exists, an earlier spiker of this risk left it: continue from its commits. Nothing on this branch ever merges.'

const ANSWER_RULES = j([
  BUILD_SLOTS_RULE,
  DRIVE_SLOTS_RULE,
  'Commit everything you made — the findings file, the prototype — to ' + SPIKE_BRANCH + ', so the evidence outlives the worktree: the branch is local and stays. Leave the issues alone: an agent after you records the answer.',
  'Once you have the answer, hold it against the charter\'s Design and Principles. The design breaks when building on the answer would need a part, an interface, or a flow the Design does not have, or would contradict a principle — set designHolds=false and quote the line. A detail the Design leaves open is never a break: decide it.',
  'For each blocked piece, read its issue and say what the answer means for it: buildable as written, or changed — and exactly how.',
  'Load /deciding and state the answer as its decision record: the answer is the decision, and the evidence is in its grounds — a prior-art line for what a lookup found, with the link; a code line for what the prototype showed, citing its file on ' + SPIKE_BRANCH + '. When the answer falls in one of /deciding\'s escalation cases, or the design breaks, write the escalation draft it asks for.',
])

function spikePrompt() {
  return j([
    CONTEXT,
    'You are the spiker for this risk. A risk is a question the plan could not guess at without risking real work. Answer it with the cheapest experiment that settles it, and stop the moment its stop condition is met — a spike that keeps going after its question is answered is waste.',
    WORKTREE_RULE,
    'Pick the cheapest form. When reading can settle it — docs, source code, an API\'s documented behaviour — load /research and do the lookup yourself against primary sources, writing its findings file in the worktree. Only when the answer needs behaviour seen running, load /prototype and build a throwaway in the worktree.',
    ANSWER_RULES,
    'If you cannot meet the stop condition — the question is too broad for one session, or the experiment will not converge — stop: return answered=false with what you learned and the narrower question that would settle the risk, and fill record with your best reading so far.',
  ])
}

function retryPrompt(first) {
  return j([
    CONTEXT,
    'You are the second spiker for this risk. The first could not meet its stop condition. Its report:',
    first.summary,
    first.evidence.length ? 'Its evidence:\n' + first.evidence.map(e => '- ' + e.what + ' — ' + e.where).join('\n') : null,
    'Answer this narrower question, which the first spiker said would settle the risk — the risk\'s stop condition, applied to it, is your stop condition:',
    first.narrower || 'none given: narrow the risk\'s question to the part the blocked pieces actually depend on, and say in summary how you narrowed it.',
    WORKTREE_RULE,
    'Use the cheapest form that settles it: a lookup per /research (load it) when reading can, else a throwaway per /prototype (load it) in the worktree. Build on what the first spiker left; never redo it.',
    ANSWER_RULES,
    'If this narrower question will not settle either, stop and return answered=false with what you learned.',
  ])
}

function guessPrompt(reports) {
  return j([
    CONTEXT,
    'Two spikes could not settle this risk. Their reports:',
    reports.map((r, i) => '--- spike ' + (i + 1) + ' ---\n' + r.summary + (r.evidence.length ? '\nEvidence:\n' + r.evidence.map(e => '- ' + e.what + ' — ' + e.where).join('\n') : '')).join('\n'),
    'Make the best guess the risk needs, per /deciding (load it): decide from its grounds, in its order, using what the spikes found, and state the guess as its decision record. Run no further experiment. Return answered=true, with summary saying it is a best guess and what would prove it wrong; the guess is flagged for Steer to reconsider.',
    'Hold the guess against the charter\'s Design and Principles, and say what it means for each blocked piece, exactly as a spiker would. When the guess falls in one of /deciding\'s escalation cases — no grounds settle it is the likely one here — or the design breaks, write the escalation draft it asks for.',
  ])
}

function recordPrompt(a, guessed, escalate) {
  const linkLine = 'Plan: ' + PLAN_REF
  return j([
    'You record the answer to one risk of a wayfinder effort in its tracker. This effort has no GitHub: its tracker, changes and commit statuses live in sc, this machine\'s forge, reached only through the sc command (run sc --help, and sc <noun> <verb> --help, before first use; every read takes --json, and a body or comment is passed as --body "$(cat <file>)", in a command of its own after the one that writes the file, with the $ unescaped: \\$(cat <file>) posts those characters as the body). Never run gh. Labels are /issue-tracker\'s vocabulary. Work from ' + REPO_ROOT + '. The plan is issue ' + PLAN_REF + '; the risk is issue #' + RISK.number + ' "' + RISK.title + '". Do every step below exactly once: if an earlier run of this step already did one — a decision issue whose body links this risk, a Builds on line already present, a comment already posted — reuse it rather than repeating it.',
    'The spike\'s finding:',
    a.summary,
    a.evidence.length ? 'Evidence:\n' + a.evidence.map(e => '- ' + e.what + ' — ' + e.where).join('\n') : null,
    'What it means for each blocked piece:\n' + (a.pieces.length ? a.pieces.map(p => '- #' + p.number + ' — ' + p.effect + ': ' + p.note).join('\n') : '- no blocked pieces'),
    escalate
      ? j([
        'This answer escalates — ' + (a.designHolds ? 'it falls in /deciding\'s "' + a.escalation + '" case' : 'it breaks the charter\'s design: ' + a.designBreak) + '. Only the human can settle it, so:',
        '1. Leave the risk open. Switch it from afk to hitl.',
        '2. Post this comment on the risk, verbatim:\n<!-- escalation -->\n' + a.escalationDraft + '\n\n**What the spike found:** ' + a.summary + (a.evidence.length ? '\n\n**Evidence:**\n' + a.evidence.map(e => '- ' + e.what + ' — ' + e.where).join('\n') : ''),
        '3. Then ask it in sc, so the issue shows as waiting on the human: sc question ask "<the question in one or two sentences, ending: the options are in the newest comment on ' + RISK.title + ' (#' + RISK.number + ')>" --issue ' + RISK.number + '.',
        '4. Publish no decision and touch no piece.',
      ])
      : j([
        '- Create the decision issue: title ' + JSON.stringify(a.record.title) + ', labelled wayfinder:decision, body exactly:\n' + linkLine + '\nAnswers: #' + RISK.number + '\n\n' + renderRecord(a.record) + '\n\nThen close it — a decision is closed once posted.',
        guessed ? '- Flag it for Steer: post this friction note on the decision issue and label it friction:\n<!-- friction -->\n**From:** the spike of #' + RISK.number + ', which could not settle the risk\n**Strain:** this decision is a best guess, not a proven answer\n**Evidence:** ' + a.summary + '\n**Suggests:** reconsider it once the code built on it shows whether it holds' : null,
        BLOCKED.length ? '- For each blocked piece (' + BLOCKED.map(p => '#' + p.number).join(', ') + '): add "- #<decision> <decision title>" under its body\'s ## Builds on, keeping every other line of the body as it is (replace a lone "- none"); add the decision as its blocker (issue block <piece> --by <decision>). A piece the finding marks changed also gets a comment saying exactly what the answer changes in it, so Steer reworks it.' : null,
        '- Close the risk with a comment naming the decision issue by its title followed by its number — Title (#<n>) — and saying in one line what it settled.',
      ]),
    'Last, from ' + REPO_ROOT + ', remove the worktree ' + WORKTREE + ' (force: its work is already committed to ' + SPIKE_BRANCH + ', which stays — never delete that branch).',
  ])
}

// ── Spike, retry, guess ──────────────────────────────────────────────────────

phase('Spike')
const reports = []
let answer = await agent(spikePrompt(), { ...tier('decider'), schema: ANSWER_SCHEMA, label: 'spike:#' + RISK.number, phase: 'Spike' })
if (answer) reports.push(answer)
if (!answer || !answer.answered) {
  const first = answer || { summary: 'the first spiker died without a report', evidence: [], narrower: '' }
  answer = await agent(retryPrompt(first), { ...tier('decider'), schema: ANSWER_SCHEMA, label: 'spike-retry:#' + RISK.number, phase: 'Spike' })
  if (answer) reports.push(answer)
}

let guessed = false
if (!answer || !answer.answered) {
  phase('Guess')
  if (!reports.length) throw new Error('Both spikers of #' + RISK.number + ' died without a report; nothing to guess from')
  answer = await agent(guessPrompt(reports), { ...tier('decider'), schema: ANSWER_SCHEMA, label: 'guess:#' + RISK.number, phase: 'Guess' })
  // No guess means nothing to record: the risk stays as it was for the lead's relaunch.
  if (!answer) throw new Error('The best-guess agent for #' + RISK.number + ' died; nothing was recorded')
  guessed = true
}

// ── Record ───────────────────────────────────────────────────────────────────

// An escalation with no draft has nothing for the human to rule on: treat the
// answer as unrecordable rather than publish it unescalated.
const escalate = !answer.designHolds || answer.escalation !== 'none'
if (escalate && !answer.escalationDraft) throw new Error('The answer to #' + RISK.number + ' escalates but carries no escalation draft; nothing was recorded')

phase('Record')
const rec = await agent(recordPrompt(answer, guessed, escalate), { ...tier('executor'), schema: RECORD_SCHEMA, label: 'record:#' + RISK.number, phase: 'Record' })
if (!rec) throw new Error('The record agent for #' + RISK.number + ' died; the answer may be partly recorded — a relaunch reuses what landed')
if (rec.problems) log('Record #' + RISK.number + ': ' + rec.problems)

log('Risk #' + RISK.number + ': ' + (escalate ? 'escalated' : (guessed ? 'best guess' : 'answered')) + (rec.decision ? ' → decision #' + rec.decision : ''))
return {
  status: escalate ? 'design-breaks' : 'answered',
  decision: rec.decision || null,
  summary: (guessed ? 'Best guess, flagged for Steer: ' : '') + (escalate && !answer.designHolds ? answer.designBreak + ' — ' : '') + answer.summary,
}
