export const meta = {
  name: 'session-scorers',
  description: 'Score past sessions in parallel: one read-only decider-tier scorer per transcript, briefed with SCORER.md, each returning four rubric labels and the incidents behind any failing one',
  phases: [
    { title: 'Score', detail: 'one scorer per transcript, in parallel; none edits a file' },
  ],
}

// Template for /rsi's scoring wave. SCORER.md owns what a scorer judges and
// reports; this file owns how the wave runs and the shape each report comes
// back in.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes): JSON.stringify or
// Python's json.dumps, spliced in with a plain string replace. Nothing goes
// through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const SCORER_BRIEF = FILL    // absolute path of the installed rsi skill's SCORER.md
const TRANSCRIPTS = FILL     // absolute transcript paths: the inventory's `sampled` list
const SCRATCH = FILL         // absolute scratch directory; each scorer writes only under <SCRATCH>/<session id>/

const DECIDER_MODEL = FILL   // per /model-policy: the decider tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the wave genuinely deviates ═══════════

const tier = () => (DECIDER_MODEL ? { model: DECIDER_MODEL } : {})
const base = p => p.split('/').pop()

const VERDICT = {
  type: 'object', required: ['label', 'reason'],
  properties: {
    label: { type: 'string', description: "one label exactly as the rubric's table spells it" },
    reason: { type: 'string', description: 'one to three sentences citing records' },
  },
}

const REPORT_SCHEMA = {
  type: 'object', required: ['scores', 'inCharge', 'incidents'],
  properties: {
    scores: {
      type: 'object', required: ['efficiency', 'code-quality', 'procedure-compliance', 'verbosity'],
      properties: {
        efficiency: VERDICT,
        'code-quality': VERDICT,
        'procedure-compliance': VERDICT,
        verbosity: VERDICT,
      },
    },
    inCharge: { type: 'string', description: 'the skill driving the session, as attributionSkill spells it, or ""' },
    incidents: {
      type: 'array',
      items: {
        type: 'object', required: ['records', 'rubric', 'experienced', 'humanWords', 'skill', 'skillsLoaded', 'owner', 'skillLine'],
        properties: {
          records: { type: 'string', description: 'the <transcript-basename>:<record> citations' },
          rubric: { type: 'string', description: 'the failing rubric: efficiency, code-quality, procedure-compliance or verbosity' },
          experienced: { type: 'string', description: 'what happened, in the human\'s terms' },
          humanWords: { type: 'string', description: 'the human\'s correction or objection verbatim, or ""' },
          skill: { type: 'string', description: 'the skill in charge at that moment, or ""' },
          skillsLoaded: { type: 'string', description: 'the skill files loaded by then' },
          owner: { type: 'string', description: 'the skill whose text governs this moment (the one quoted, or the one triggered and never loaded), or ""' },
          skillLine: { type: 'string', description: 'the owner\'s line behind it, quoted from the version that ran, or ""' },
        },
      },
    },
  },
}

function scorerPrompt(t) {
  return [
    'You are one scorer in a wave grading past Claude Code sessions. Read ' + SCORER_BRIEF + ' and follow it exactly; it is your whole brief.',
    'Your transcript: ' + t,
    'Your scratch directory: ' + SCRATCH + '/' + base(t).replace(/\.jsonl$/, '') + '/ — write nothing anywhere else.',
    'Return the report the brief asks for in the structured fields.',
  ].join('\n')
}

phase('Score')
const reports = await pipeline(TRANSCRIPTS, t =>
  agent(scorerPrompt(t), { label: 'score:' + base(t), phase: 'Score', schema: REPORT_SCHEMA, ...tier() }))

const scored = [], missing = []
TRANSCRIPTS.forEach((t, i) => (reports[i] ? scored.push({ transcript: t, ...reports[i] }) : missing.push(t)))
if (missing.length) log(missing.length + ' transcript(s) returned no report: ' + missing.map(base).join(', '))
return { scored, missing }
