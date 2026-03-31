/**
 * Startup graph budget CI check (Phase 0)
 *
 * Verifies the main bundle's startup graph does not exceed module count
 * and code size budgets. Exits with code 1 if any budget is exceeded.
 *
 * Usage:
 *   ENABLE_NATIVE_BACKGROUND_THREAD=true METRO_RUNTIME_TARGET=main \
 *     node --max-old-space-size=8192 scripts/check-startup-graph-budget.js
 *
 * Environment variables:
 *   STARTUP_MODULE_BUDGET  - Max module count (default: 18500)
 *   STARTUP_SIZE_BUDGET_MB - Max code size in MB (default: 50)
 *   ENTRY                  - Entry name: 'main' or 'background' (default: 'main')
 */

const path = require('path');
const fs = require('fs-extra');

const mobileDirPath = path.resolve(__dirname, '..');
const outDir = path.resolve(mobileDirPath, 'out-dir-analysis');

// Budgets — calibrated from Phase 0 baseline measurements.
// main-with-alias: 17783 modules as of 2026-04-01
// These should be tightened as the startup graph shrinks.
const MODULE_BUDGET = parseInt(
  process.env.STARTUP_MODULE_BUDGET || '18500',
  10,
);
const SIZE_BUDGET_BYTES =
  parseFloat(process.env.STARTUP_SIZE_BUDGET_MB || '50') * 1024 * 1024;

function relativePath(absPath, root) {
  return absPath.replace(root, '').replace(/^\//, '');
}

function categorizeModule(relPath) {
  if (relPath.includes('node_modules/')) return 'node_modules';
  if (relPath.includes('kit-bg/src/services/')) return 'services';
  if (relPath.includes('kit-bg/src/vaults/')) return 'vaults';
  if (relPath.includes('packages/components/')) return 'components';
  if (relPath.includes('packages/kit/')) return 'kit';
  if (relPath.includes('packages/kit-bg/')) return 'kit-bg';
  if (relPath.includes('packages/shared/')) return 'shared';
  return 'other';
}

// Modules that must NOT appear in the startup graph when alias is active.
// If any of these are found, the budget check fails with a specific error.
const FORBIDDEN_IN_STARTUP = [
  // BackgroundApi concrete implementation — must be excluded from main bundle
  'packages/kit-bg/src/apis/BackgroundApi.ts',
  'packages/kit-bg/src/apis/BackgroundApiBase.ts',
];

async function main() {
  const Metro = require('metro');
  const { loadConfig } = require('metro-config');

  const entryName = process.env.ENTRY || 'main';
  const entryFile =
    entryName === 'background'
      ? path.resolve(mobileDirPath, 'background.ts')
      : path.resolve(mobileDirPath, 'index.ts');

  const enableNativeBg =
    process.env.ENABLE_NATIVE_BACKGROUND_THREAD === 'true';

  console.log('=== Startup Graph Budget Check ===\n');
  console.log(`Entry:          ${entryName}`);
  console.log(`Native BG:      ${enableNativeBg}`);
  console.log(`Module budget:  ${MODULE_BUDGET}`);
  console.log(`Size budget:    ${(SIZE_BUDGET_BYTES / 1024 / 1024).toFixed(0)} MB\n`);

  const config = await loadConfig({ cwd: mobileDirPath });

  const startTime = Date.now();
  const graph = await Metro.buildGraph(config, {
    entries: [entryFile],
    platform: 'ios',
    dev: false,
    minify: false,
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const monorepoRoot = path.resolve(mobileDirPath, '../..');
  const allModules = Array.from(graph.dependencies.entries());
  const totalModules = allModules.length;

  // Estimate code size
  let totalSize = 0;
  for (const [, moduleData] of allModules) {
    if (moduleData.output) {
      for (const o of moduleData.output) {
        if (o.data && o.data.code) {
          totalSize += o.data.code.length;
        }
      }
    }
  }

  // Categorize
  const categories = {};
  for (const [absPath] of allModules) {
    const rel = relativePath(absPath, monorepoRoot);
    const cat = categorizeModule(rel);
    categories[cat] = (categories[cat] || 0) + 1;
  }

  // Check forbidden modules
  const foundForbidden = [];
  if (enableNativeBg) {
    for (const [absPath] of allModules) {
      const rel = relativePath(absPath, monorepoRoot);
      if (FORBIDDEN_IN_STARTUP.some((f) => rel.includes(f))) {
        foundForbidden.push(rel);
      }
    }
  }

  // Print results
  console.log(`Graph built in ${elapsed}s`);
  console.log(`Total modules: ${totalModules} (budget: ${MODULE_BUDGET})`);
  console.log(
    `Code size:     ${(totalSize / 1024 / 1024).toFixed(2)} MB (budget: ${(SIZE_BUDGET_BYTES / 1024 / 1024).toFixed(0)} MB)`,
  );
  console.log('\nCategories:');
  const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    console.log(`  ${cat.padEnd(20)} ${count}`);
  }

  // Write report
  fs.ensureDirSync(outDir);
  const report = {
    entry: entryName,
    enableNativeBackgroundThread: enableNativeBg,
    totalModules,
    moduleBudget: MODULE_BUDGET,
    estimatedCodeSizeBytes: totalSize,
    sizeBudgetBytes: SIZE_BUDGET_BYTES,
    categories,
    forbiddenModulesFound: foundForbidden,
    pass: true,
    failures: [],
  };

  // Check budgets
  const failures = [];

  if (totalModules > MODULE_BUDGET) {
    failures.push(
      `Module count ${totalModules} exceeds budget ${MODULE_BUDGET} (+${totalModules - MODULE_BUDGET})`,
    );
  }

  if (totalSize > SIZE_BUDGET_BYTES) {
    failures.push(
      `Code size ${(totalSize / 1024 / 1024).toFixed(2)} MB exceeds budget ${(SIZE_BUDGET_BYTES / 1024 / 1024).toFixed(0)} MB`,
    );
  }

  if (foundForbidden.length > 0) {
    failures.push(
      `Forbidden modules in startup graph: ${foundForbidden.join(', ')}`,
    );
  }

  report.failures = failures;
  report.pass = failures.length === 0;

  const reportPath = path.join(outDir, 'budget-check-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  if (failures.length > 0) {
    console.log('\n=== BUDGET CHECK FAILED ===');
    failures.forEach((f) => console.log(`  FAIL: ${f}`));
    console.log(`\nReport: ${reportPath}`);
    process.exit(1);
  } else {
    console.log('\n=== BUDGET CHECK PASSED ===');
    console.log(`Report: ${reportPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
