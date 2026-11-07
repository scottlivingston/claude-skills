export const meta = {
  name: 'verification-source-wave',
  description: 'Read an app\'s source once per feature file of its verification skill, in parallel: each decider-tier reader explains the feature from source, flags likely drift with citations, and proposes one live-verification recipe',
  phases: [
    { title: 'Read', detail: 'one read-only reader per feature file; none drives the app or edits a file' },
  ],
}

// Template for /maintain-verification-skill's source wave. SKILL.md owns what the
// wave is for and what happens to its reports; this file owns each reader's
// prompt and the shape its report comes back in.
//
// USAGE: fill every FILL slot below, then launch the result as the Workflow
// `script`. An unfilled slot throws "FILL is not defined" at launch. Fill prose
// slots as JSON string literals (double quotes, \n escapes): JSON.stringify or
// Python's json.dumps, spliced in with a plain string replace. Nothing goes
// through `args`.

// ══════════════════ DATA SLOTS — fill every FILL before launching ══════════════════

const SKILL_DIR = FILL       // the verification skill's directory, repo-relative, e.g. ".claude/skills/verify-web"
const APP_DIR = FILL         // the app's source directory, repo-relative, e.g. "apps/web"
const FEATURES = FILL        // the feature files, repo-relative, e.g. [".claude/skills/verify-web/features/search.md"]

const DECIDER_MODEL = FILL   // per /model-policy: the decider tier's resolved model, or null to inherit

// ═══════════ FIXED BELOW THIS LINE — edit only when the wave genuinely deviates ═══════════

const tier = () => (DECIDER_MODEL ? { model: DECIDER_MODEL } : {})
const base = p => p.split('/').pop().replace(/\.md$/, '')

const REPORT_SCHEMA = {
  type: 'object', required: ['summary', 'entryPoints', 'drift', 'recipe'],
  properties: {
    summary: { type: 'string', description: 'how the user-facing feature works, from source' },
    entryPoints: { type: 'array', items: { type: 'string' }, description: 'source paths (with line numbers where useful) where the feature starts' },
    drift: {
      type: 'array', description: 'places the feature file disagrees with the source; empty when none',
      items: {
        type: 'object', required: ['claim', 'source', 'citation'],
        properties: {
          claim: { type: 'string', description: 'what the feature file says, quoted' },
          source: { type: 'string', description: 'what the source does instead' },
          citation: { type: 'string', description: 'path:line proving it' },
        },
      },
    },
    recipe: { type: 'string', description: 'one live-verification recipe: the app state needed and the steps that show the feature working' },
  },
}

function readerPrompt(f) {
  return [
    'You are one reader in a wave checking a verification skill\'s feature map against the app\'s source. The skill lives at ' + SKILL_DIR + '; the app at ' + APP_DIR + '.',
    'Your feature file: ' + f + '. Read it, then explain from source how its user-facing feature works.',
    'Report the source entry points, every place the feature file disagrees with the source (quote the file, cite the source by path:line), and one recipe for verifying the feature live.',
    'Read only: never launch or drive the app, and never edit a file.',
  ].join('\n')
}

phase('Read')
const reports = await pipeline(FEATURES, f =>
  agent(readerPrompt(f), { label: 'source:' + base(f), phase: 'Read', schema: REPORT_SCHEMA, ...tier() }))

const read = [], missing = []
FEATURES.forEach((f, i) => (reports[i] ? read.push({ feature: f, ...reports[i] }) : missing.push(f)))
if (missing.length) log(missing.length + ' feature file(s) returned no report: ' + missing.join(', '))
return { read, missing }
