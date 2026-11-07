export const meta = {
  name: 'design-it-twice',
  description: 'Design one deepened module\'s interface several radically different ways in parallel, one decider-tier designer per design constraint',
  phases: [
    { title: 'Design', detail: 'one designer per constraint, none seeing the others' },
  ],
}

// Template for /codebase-design's Design It Twice. DESIGN-IT-TWICE.md owns when
// to run it, the technical brief, and how the designs are compared; this file
// owns the design constraints, each designer's prompt, and the shape each design
// comes back in.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes): JSON.stringify or
// Python's json.dumps, spliced in with a plain string replace. Nothing goes
// through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const BRIEF = FILL           // the technical brief: file paths, coupling details, the dependency category, what sits behind the seam
const VOCABULARY = FILL      // absolute paths every designer reads for names: the codebase-design SKILL.md and DEEPENING.md, and the project's CONTEXT.md when it has one
const PORTS = FILL           // true when the module has cross-seam dependencies, adding the ports-and-adapters designer

const DECIDER_MODEL = FILL   // per /model-policy: the decider tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the designs genuinely deviate ═══════════

const tier = () => (DECIDER_MODEL ? { model: DECIDER_MODEL } : {})

const CONSTRAINTS = [
  { key: 'minimal', text: 'Minimize the interface — aim for 1–3 entry points at most. Maximise leverage per entry point.' },
  { key: 'flexible', text: 'Maximise flexibility — support many use cases and extension.' },
  { key: 'common-caller', text: 'Optimise for the most common caller — make the default case trivial.' },
  PORTS ? { key: 'ports', text: 'Design around ports and adapters for the cross-seam dependencies.' } : null,
].filter(Boolean)

const DESIGN_SCHEMA = {
  type: 'object', required: ['interface', 'usage', 'hidden', 'dependencies', 'tradeoffs'],
  properties: {
    interface: { type: 'string', description: 'types, methods, params — plus invariants, ordering, and error modes' },
    usage: { type: 'string', description: 'an example of how callers use it' },
    hidden: { type: 'string', description: 'what the implementation hides behind the seam' },
    dependencies: { type: 'string', description: 'the dependency strategy and adapters, per DEEPENING.md' },
    tradeoffs: { type: 'string', description: 'where leverage is high and where it is thin' },
  },
}

function designerPrompt(c) {
  return [
    'You are designing the interface of one deepened module. Other designers are working the same brief under different constraints; make yours radically different from the obvious design.',
    'Read these for the names to use, and use them consistently: ' + VOCABULARY.join(', '),
    'The brief:',
    BRIEF,
    'Your design constraint: ' + c.text,
    'Design only: edit no file.',
  ].join('\n')
}

phase('Design')
const designs = await pipeline(CONSTRAINTS, c =>
  agent(designerPrompt(c), { label: 'design:' + c.key, phase: 'Design', schema: DESIGN_SCHEMA, ...tier() }))

const done = []
CONSTRAINTS.forEach((c, i) => {
  if (designs[i]) done.push({ constraint: c.text, ...designs[i] })
  else log('the ' + c.key + ' designer returned nothing')
})
return { designs: done }
