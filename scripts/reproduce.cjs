require('../tests/register.cjs');
const fs = require('node:fs');
const os = require('node:os');
const { createHash } = require('node:crypto');
const input = require('../examples/routine/input.json');
const { generateRoutineRecommendations, createSolverMetrics } = require('../src/lib/routine-generator/solver.ts');
const { scoreDraft } = require('../src/lib/routine-generator/scoring.ts');
const { verify } = require('./verify-routine.cjs');
function run() {
  const metrics = createSolverMetrics(input.options.seed);
  const drafts = generateRoutineRecommendations(input, 3, 25000, metrics);
  for (const draft of drafts) verify(input, draft.assignments);
  const { elapsedMs, ...stableMetrics } = metrics;
  return { stable: { input, metrics: stableMetrics, drafts: drafts.map(d => ({ ...d, penalties: scoreDraft(d.assignments, input).warnings })) }, elapsedMs };
}
const a = run(), b = run();
const normalized = JSON.stringify(a.stable, null, 2) + '\n';
if (normalized !== JSON.stringify(b.stable, null, 2) + '\n') throw new Error('Reproduction mismatch');
fs.writeFileSync('examples/routine/output.json', normalized);
fs.writeFileSync('examples/routine/environment.json', JSON.stringify({ node: process.version, platform: process.platform,
  architecture: process.arch, cpu: os.cpus()[0]?.model, elapsedMs: a.elapsedMs,
  peakRssMiB: process.resourceUsage().maxRSS / 1024, sha256: createHash('sha256').update(normalized).digest('hex') }, null, 2) + '\n');
console.log(JSON.stringify({ drafts: a.stable.drafts.length, ...a.stable.metrics, byteIdentical: true }));
