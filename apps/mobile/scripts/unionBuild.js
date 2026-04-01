/**
 * Union Graph Build Script
 *
 * Replaces two `react-native bundle` CLI calls with a single
 * Metro.buildGraph([main, background]) for cross-runtime deduplication.
 *
 * Usage:
 *   UNION_BUILD=true node --max-old-space-size=8192 scripts/unionBuild.js --platform ios
 */

const path = require('path');
const fs = require('fs-extra');
const Metro = require('metro');
const { loadConfig } = require('metro-config');
const { computeEntryReachability } = require('../plugins/entryReachability');

const mobileDirPath = path.resolve(__dirname, '..');
const mainEntry = path.resolve(mobileDirPath, 'index.ts');
const bgEntry = path.resolve(mobileDirPath, 'background.ts');

async function main() {
  const platform = process.argv.includes('--platform')
    ? process.argv[process.argv.indexOf('--platform') + 1]
    : 'ios';

  console.log(`Union build: platform=${platform}`);
  console.log('Loading Metro config...');
  const config = await loadConfig({ cwd: mobileDirPath });

  // Apply the split code plugin
  const splitCodePlugin = require('../plugins');
  const finalConfig = splitCodePlugin(config, mobileDirPath);

  console.log('Building unified graph...');
  const startTime = Date.now();
  const graph = await Metro.buildGraph(finalConfig, {
    entries: [mainEntry, bgEntry],
    platform,
    dev: false,
    minify: false,
  });
  console.log(`Graph built in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`Total modules: ${graph.dependencies.size}`);

  // Compute entry reachability
  const reachability = computeEntryReachability(graph, mainEntry, bgEntry);
  console.log(`Main-only modules: ${reachability.mainOnly.size}`);
  console.log(`BG-only modules:   ${reachability.bgOnly.size}`);
  console.log(`Shared modules:    ${reachability.shared.size}`);

  // Write reachability report
  const reportDir = path.resolve(mobileDirPath, 'out-dir-analysis');
  fs.ensureDirSync(reportDir);
  const report = {
    totalModules: graph.dependencies.size,
    mainOnly: reachability.mainOnly.size,
    bgOnly: reachability.bgOnly.size,
    shared: reachability.shared.size,
    // Potential savings: shared modules currently duplicated in both bundles
    estimatedDuplicateModules: reachability.shared.size,
  };
  fs.writeFileSync(
    path.join(reportDir, 'union-graph-report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(`Report: ${path.join(reportDir, 'union-graph-report.json')}`);

  // TODO Phase 2: Serialize per-entry bundles from the unified graph
  // This requires calling baseJSBundle twice with filtered module lists
  // and is deferred to a follow-up iteration.
  console.log('Union build complete (analysis phase — serialization TBD)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
