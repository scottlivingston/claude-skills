export const meta = {
  name: 'transcript-readers',
  description: 'Read past sessions in parallel: one read-only decider-tier reader per transcript, briefed with READER.md, each returning its incidents and flow health',
  phases: [
    { title: 'Read', detail: 'one reader per transcript, in parallel; none edits a file' },
  ],
}

// Template for the transcript-reader wave that /autopsy's sweep and
// /maintain-iterate both run. READER.md owns what a reader does and reports;
// this file owns how the wave runs and the shape each report comes back in.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes): JSON.stringify or
// Python's json.dumps, spliced in with a plain string replace. Nothing goes
// through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const READER_BRIEF = FILL    // absolute path of the installed autopsy skill's READER.md
const SKILL = FILL           // the skill under study, e.g. "scott-skills:iterate"
const TRANSCRIPTS = FILL     // absolute transcript paths, e.g. ["/Users/me/.claude/projects/-repo/abc.jsonl"]
const SCRATCH = FILL         // absolute scratch directory; each reader writes only under <SCRATCH>/<session id>/

const DECIDER_MODEL = FILL   // per /model-policy: the decider tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the wave genuinely deviates ═══════════

const tier = () => (DECIDER_MODEL ? { model: DECIDER_MODEL } : {})
const base = p => p.split('/').pop()

const REPORT_SCHEMA = {
  type: 'object', required: ['incidents', 'flowHealth'],
  properties: {
    incidents: {
      type: 'array',
      items: {
        type: 'object', required: ['records', 'experienced', 'doing', 'skillsLoaded', 'evidence', 'cause'],
        properties: {
          records: { type: 'string', description: 'the <transcript-basename>:<record> citations' },
          experienced: { type: 'string', description: 'what the human experienced, in their terms' },
          doing: { type: 'string', description: 'what the agent was doing' },
          skillsLoaded: { type: 'string', description: 'the skill files loaded at that point' },
          evidence: { type: 'string', description: 'both sides quoted verbatim: the transcript moment and the skill line' },
          cause: { type: 'string', description: 'the cause per the autopsy Diagnose with its quote, or "" when no skill line caused it' },
        },
      },
    },
    flowHealth: { type: 'string', description: 'the flow-health report per the brief; "None seen" for a clean section' },
  },
}

function readerPrompt(t) {
  return [
    'You are one reader in a wave reading past Claude Code sessions. Read ' + READER_BRIEF + ' and follow it exactly; it is your whole brief.',
    'Your transcript: ' + t,
    'The skill under study: ' + SKILL,
    'Your scratch directory: ' + SCRATCH + '/' + base(t).replace(/\.jsonl$/, '') + '/ — write nothing anywhere else.',
    'Return the report the brief asks for in the structured fields.',
  ].join('\n')
}

phase('Read')
const reports = await pipeline(TRANSCRIPTS, t =>
  agent(readerPrompt(t), { label: 'read:' + base(t), phase: 'Read', schema: REPORT_SCHEMA, ...tier() }))

const read = [], missing = []
TRANSCRIPTS.forEach((t, i) => (reports[i] ? read.push({ transcript: t, ...reports[i] }) : missing.push(t)))
if (missing.length) log(missing.length + ' transcript(s) returned no report: ' + missing.map(base).join(', '))
return { read, missing }
