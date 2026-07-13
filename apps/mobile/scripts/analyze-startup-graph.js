/**
 * Startup graph analysis script (Phase 0)
 *
 * Uses Metro's buildGraph API to analyze the dependency graph for a given entry.
 * Reports module count, categorization, and detects modules that violate allocation rules.
 *
 * Usage:
 *   # Analyze main bundle (baseline, no native background thread)
 *   ENABLE_NATIVE_BACKGROUND_THREAD=false METRO_RUNTIME_TARGET=main \
 *     node --max-old-space-size=8192 scripts/analyze-startup-graph.js
 *
 *   # Analyze main bundle (with native-ui alias)
 *   ENABLE_NATIVE_BACKGROUND_THREAD=true METRO_RUNTIME_TARGET=main \
 *     node --max-old-space-size=8192 scripts/analyze-startup-graph.js
 *
 *   # Analyze background bundle
 *   ENABLE_NATIVE_BACKGROUND_THREAD=true METRO_RUNTIME_TARGET=background \
 *     node --max-old-space-size=8192 scripts/analyze-startup-graph.js background
 *
 *   # Compare main vs background
 *   node --max-old-space-size=8192 scripts/analyze-startup-graph.js compare
 */

const path = require('path');

const fs = require('fs-extra');

const mobileDirPath = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(mobileDirPath, '../..');
const outDir = path.resolve(mobileDirPath, 'out-dir-analysis');
const distDir = path.resolve(mobileDirPath, 'dist');

process.env.ONEKEY_PLATFORM = process.env.ONEKEY_PLATFORM || 'app';
if (process.env.ENABLE_NATIVE_BACKGROUND_THREAD === 'true') {
  process.env.SPLIT_BUNDLE = process.env.SPLIT_BUNDLE || '1';
  process.env.SPLIT_BUNDLE_SEGMENTS =
    process.env.SPLIT_BUNDLE_SEGMENTS || 'true';
}

function relativePath(absPath) {
  return absPath.replace(monorepoRoot, '').replace(/^\//, '');
}

function categorizeModule(relPath) {
  if (relPath.includes('node_modules/')) return 'node_modules';
  if (relPath.includes('kit-bg/src/services/')) return 'services';
  if (relPath.includes('kit-bg/src/vaults/')) return 'vaults';
  if (relPath.includes('kit-bg/src/connectors/')) return 'connectors';
  if (relPath.includes('kit-bg/src/dbs/')) return 'dbs';
  if (relPath.includes('kit-bg/src/apis/')) return 'apis';
  if (relPath.includes('kit-bg/src/states/')) return 'states';
  if (relPath.includes('kit-bg/src/providers/')) return 'providers';
  if (relPath.includes('packages/kit-bg/')) return 'kit-bg-other';
  if (relPath.includes('packages/components/')) return 'components';
  if (relPath.includes('packages/kit/')) return 'kit';
  if (relPath.includes('packages/shared/')) return 'shared';
  if (relPath.includes('packages/core/')) return 'core';
  if (relPath.includes('apps/mobile/')) return 'app-mobile';
  return 'other';
}

function estimateModuleSize(moduleData) {
  // Use the output code length as a rough size estimate
  if (moduleData.output && moduleData.output.length > 0) {
    return moduleData.output.reduce((sum, o) => {
      if (o.data && o.data.code) {
        return sum + o.data.code.length;
      }
      return sum;
    }, 0);
  }
  return 0;
}

function buildReportFromModuleList({ label, modules, estimatedCodeSizeBytes }) {
  const categories = {};
  const categorySizes = {};

  for (const relPath of modules) {
    const cat = categorizeModule(relPath);
    categories[cat] = (categories[cat] || 0) + 1;
  }

  const bgApiModules = modules.filter(
    (m) => m.includes('BackgroundApi') || m.includes('backgroundApiInit'),
  );
  const serviceModules = modules.filter(
    (m) => m.includes('/services/Service') && m.includes('kit-bg'),
  );
  const vaultModules = modules.filter(
    (m) => m.includes('/vaults/') && m.includes('kit-bg'),
  );

  console.log(`=== ${label} ===`);
  console.log(`Total modules:          ${modules.length}`);
  console.log(
    `Estimated code size:    ${(estimatedCodeSizeBytes / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(`BackgroundApi modules:  ${bgApiModules.length}`);
  console.log(`Service modules:        ${serviceModules.length}`);
  console.log(`Vault/chain SDK:        ${vaultModules.length}`);

  console.log('\n--- Module Count by Category ---');
  const sortedCats = Object.entries(categories).toSorted((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    const sizeStr = categorySizes[cat]
      ? ` (${(categorySizes[cat] / 1024).toFixed(0)} KB)`
      : '';
    console.log(`  ${cat.padEnd(20)} ${String(count).padStart(6)}${sizeStr}`);
  }

  if (bgApiModules.length > 0) {
    console.log('\n--- BackgroundApi Modules ---');
    bgApiModules.forEach((m) => console.log(`  ${m}`));
  }

  fs.ensureDirSync(outDir);
  const moduleListPath = path.join(
    outDir,
    `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-modules.txt`,
  );
  fs.writeFileSync(moduleListPath, modules.toSorted().join('\n'));

  const report = {
    label,
    totalModules: modules.length,
    estimatedCodeSizeBytes,
    backgroundApiModules: bgApiModules.length,
    serviceModules: serviceModules.length,
    vaultModules: vaultModules.length,
    categories,
    categorySizes,
    backgroundApiModuleList: bgApiModules,
    serviceModuleList: serviceModules,
  };
  const reportPath = path.join(
    outDir,
    `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\nModule list: ${moduleListPath}`);
  console.log(`JSON report: ${reportPath}`);

  return report;
}

function tryAnalyzeAllocationReport(entryName, label) {
  const reportPath = path.resolve(
    distDir,
    `allocation-report-${entryName}.json`,
  );
  if (!fs.existsSync(reportPath)) {
    return null;
  }

  const allocationReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const startup = allocationReport.startup || {};
  const startupModules = startup.modules;
  if (!Array.isArray(startupModules)) {
    return null;
  }

  console.log(`Using allocation report: ${reportPath}`);
  return buildReportFromModuleList({
    label,
    modules: startupModules,
    estimatedCodeSizeBytes: startup.estimatedSizeBytes || 0,
  });
}

async function buildGraphForEntry(entryName) {
  const Metro = require('metro');
  const { loadConfig } = require('metro-config');

  const entryFile =
    entryName === 'background'
      ? path.resolve(mobileDirPath, 'background.ts')
      : path.resolve(mobileDirPath, 'index.ts');

  const config = await loadConfig({ cwd: mobileDirPath });

  console.log(`Building dependency graph for: ${entryName} (${entryFile})`);
  console.log(
    `  ENABLE_NATIVE_BACKGROUND_THREAD=${process.env.ENABLE_NATIVE_BACKGROUND_THREAD}`,
  );
  console.log(`  METRO_RUNTIME_TARGET=${process.env.METRO_RUNTIME_TARGET}`);

  const startTime = Date.now();
  const graph = await Metro.buildGraph(config, {
    entries: [entryFile],
    platform: 'ios',
    dev: false,
    minify: false,
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Graph built in ${elapsed}s\n`);

  return graph;
}

function analyzeGraph(graph, label) {
  const allModules = Array.from(graph.dependencies.entries());
  const totalModules = allModules.length;

  // Categorize
  const categories = {};
  const modulesByCategory = {};
  let totalEstimatedSize = 0;
  const categorySizes = {};

  for (const [absPath, moduleData] of allModules) {
    const rel = relativePath(absPath);
    const cat = categorizeModule(rel);
    categories[cat] = (categories[cat] || 0) + 1;
    if (!modulesByCategory[cat]) modulesByCategory[cat] = [];
    modulesByCategory[cat].push(rel);

    const size = estimateModuleSize(moduleData);
    totalEstimatedSize += size;
    categorySizes[cat] = (categorySizes[cat] || 0) + size;
  }

  // BackgroundApi specific checks
  const bgApiModules = allModules
    .filter(
      ([m]) => m.includes('BackgroundApi') || m.includes('backgroundApiInit'),
    )
    .map(([m]) => relativePath(m));

  const serviceModules = allModules
    .filter(([m]) => m.includes('/services/Service') && m.includes('kit-bg'))
    .map(([m]) => relativePath(m));

  const vaultModules = allModules
    .filter(([m]) => m.includes('/vaults/') && m.includes('kit-bg'))
    .map(([m]) => relativePath(m));

  console.log(`=== ${label} ===`);
  console.log(`Total modules:          ${totalModules}`);
  console.log(
    `Estimated code size:    ${(totalEstimatedSize / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(`BackgroundApi modules:  ${bgApiModules.length}`);
  console.log(`Service modules:        ${serviceModules.length}`);
  console.log(`Vault/chain SDK:        ${vaultModules.length}`);

  console.log('\n--- Module Count by Category ---');
  const sortedCats = Object.entries(categories).toSorted((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    const sizeStr = categorySizes[cat]
      ? ` (${(categorySizes[cat] / 1024).toFixed(0)} KB)`
      : '';
    console.log(`  ${cat.padEnd(20)} ${String(count).padStart(6)}${sizeStr}`);
  }

  if (bgApiModules.length > 0) {
    console.log('\n--- BackgroundApi Modules ---');
    bgApiModules.forEach((m) => console.log(`  ${m}`));
  }

  // Write module list
  fs.ensureDirSync(outDir);
  const moduleListPath = path.join(
    outDir,
    `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-modules.txt`,
  );
  fs.writeFileSync(
    moduleListPath,
    allModules
      .map(([m]) => relativePath(m))
      .toSorted()
      .join('\n'),
  );

  const report = {
    label,
    totalModules,
    estimatedCodeSizeBytes: totalEstimatedSize,
    backgroundApiModules: bgApiModules.length,
    serviceModules: serviceModules.length,
    vaultModules: vaultModules.length,
    categories,
    categorySizes,
    backgroundApiModuleList: bgApiModules,
    serviceModuleList: serviceModules,
  };
  const reportPath = path.join(
    outDir,
    `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\nModule list: ${moduleListPath}`);
  console.log(`JSON report: ${reportPath}`);

  return report;
}

async function main() {
  const mode = process.argv[2] || 'main';

  if (mode === 'compare') {
    // Build both graphs and compare
    console.log('=== Startup Graph Comparison ===\n');

    // Save and set env for main baseline
    const origEnableNativeBg = process.env.ENABLE_NATIVE_BACKGROUND_THREAD;
    const origTarget = process.env.METRO_RUNTIME_TARGET;

    process.env.ENABLE_NATIVE_BACKGROUND_THREAD = 'false';
    process.env.ONEKEY_PLATFORM = 'app';
    process.env.METRO_RUNTIME_TARGET = 'main';
    const baselineGraph = await buildGraphForEntry('main');
    const baseline = analyzeGraph(baselineGraph, 'main-baseline');

    console.log('\n');

    process.env.ENABLE_NATIVE_BACKGROUND_THREAD = 'true';
    process.env.SPLIT_BUNDLE = process.env.SPLIT_BUNDLE || '1';
    process.env.SPLIT_BUNDLE_SEGMENTS =
      process.env.SPLIT_BUNDLE_SEGMENTS || 'true';
    process.env.METRO_RUNTIME_TARGET = 'main';
    const withAlias =
      tryAnalyzeAllocationReport('main', 'main-with-alias') ||
      analyzeGraph(await buildGraphForEntry('main'), 'main-with-alias');

    // Restore env
    process.env.ENABLE_NATIVE_BACKGROUND_THREAD = origEnableNativeBg;
    process.env.METRO_RUNTIME_TARGET = origTarget;

    console.log('\n=== Comparison ===');
    console.log(
      `Module count:  ${baseline.totalModules} -> ${withAlias.totalModules} (${withAlias.totalModules - baseline.totalModules})`,
    );
    console.log(
      `Code size:     ${(baseline.estimatedCodeSizeBytes / 1024 / 1024).toFixed(2)} MB -> ${(withAlias.estimatedCodeSizeBytes / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(
      `Services:      ${baseline.serviceModules} -> ${withAlias.serviceModules}`,
    );
    console.log(
      `Vaults:        ${baseline.vaultModules} -> ${withAlias.vaultModules}`,
    );
    console.log(
      `Reduction:     ${((1 - withAlias.totalModules / baseline.totalModules) * 100).toFixed(1)}% modules, ${((1 - withAlias.estimatedCodeSizeBytes / baseline.estimatedCodeSizeBytes) * 100).toFixed(1)}% code size`,
    );
  } else if (mode === 'background') {
    const report =
      tryAnalyzeAllocationReport('background', 'background') ||
      analyzeGraph(await buildGraphForEntry('background'), 'background');
    return report;
  } else {
    const label =
      process.env.ENABLE_NATIVE_BACKGROUND_THREAD === 'true'
        ? 'main-with-alias'
        : 'main-baseline';
    const report =
      (process.env.ENABLE_NATIVE_BACKGROUND_THREAD === 'true'
        ? tryAnalyzeAllocationReport('main', label)
        : null) || analyzeGraph(await buildGraphForEntry('main'), label);
    return report;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
