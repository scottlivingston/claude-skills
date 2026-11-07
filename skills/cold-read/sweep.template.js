export const meta = {
  name: 'cold-read-sweep',
  description: 'Cold-read several documents in parallel: one decider-tier reader per document lists its referents, resolves them, and sweeps it against the defect list, returning findings with proofs and no edits',
  phases: [
    { title: 'Sweep', detail: 'one read-only reader per document' },
  ],
}

// Template for /cold-read's multi-document sweep. SKILL.md owns the defect list,
// the steps each reader runs, and the repairs that follow; this file owns each
// reader's prompt and the shape its findings come back in.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes): JSON.stringify or
// Python's json.dumps, spliced in with a plain string replace. Nothing goes
// through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const COLD_READ_SKILL = FILL // absolute path of the installed cold-read skill's SKILL.md
const DOCUMENTS = FILL       // repo-relative paths of the documents to sweep, e.g. ["skills/ship/SKILL.md"]

const DECIDER_MODEL = FILL   // per /model-policy: the decider tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the sweep genuinely deviates ═══════════

const tier = () => (DECIDER_MODEL ? { model: DECIDER_MODEL } : {})

const FINDINGS_SCHEMA = {
  type: 'object', required: ['findings'],
  properties: {
    findings: {
      type: 'array', description: 'empty when the document reads clean',
      items: {
        type: 'object', required: ['kind', 'quote', 'proof', 'repair', 'provable'],
        properties: {
          kind: { enum: ['ghost', 'broken pointer', 'changelog prose', 'alias', 'undefined term', 'residue', 'stale cache', 'contradiction'] },
          quote: { type: 'string', description: 'the passage, verbatim, with enough context to find it' },
          proof: { type: 'string', description: 'the lookup that proves the defect, rerunnable by anyone' },
          repair: { type: 'string', description: 'the repaired text, or what the question is when no lookup settles it' },
          provable: { type: 'boolean', description: 'true when the proof licenses the repair; false makes it a question for the human' },
        },
      },
    },
  },
}

function readerPrompt(d) {
  return [
    'You are one reader in a cold-read sweep over several documents. Read ' + COLD_READ_SKILL + ': its Defects section and steps 2–4 of its Process are your brief.',
    'Your document: ' + d + '. Run steps 2–4 on it — list every referent, resolve each one, and sweep the document against the defect list — and return every defect you find with its proof.',
    'Edit nothing: the session that launched you applies the repairs.',
  ].join('\n')
}

phase('Sweep')
const reports = await pipeline(DOCUMENTS, d =>
  agent(readerPrompt(d), { label: 'sweep:' + d, phase: 'Sweep', schema: FINDINGS_SCHEMA, ...tier() }))

const swept = [], missing = []
DOCUMENTS.forEach((d, i) => (reports[i] ? swept.push({ document: d, ...reports[i] }) : missing.push(d)))
if (missing.length) log(missing.length + ' document(s) returned no findings: ' + missing.join(', '))
return { swept, missing }
