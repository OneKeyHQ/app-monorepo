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
const distDir = path.resolve(mobileDirPath, 'dist');

process.env.ONEKEY_PLATFORM = process.env.ONEKEY_PLATFORM || 'app';
if (process.env.ENABLE_NATIVE_BACKGROUND_THREAD === 'true') {
  process.env.SPLIT_BUNDLE = process.env.SPLIT_BUNDLE || '1';
  process.env.SPLIT_BUNDLE_SEGMENTS =
    process.env.SPLIT_BUNDLE_SEGMENTS || 'true';
}

// Budgets — re-tuned 2026-04-20 after the three-bundle / native-background
// split landed. Caller is expected to pass per-entry budgets via env vars
// (see .github/workflows/startup-graph-budget.yml); defaults here are fallbacks
// tuned for the background entry (the larger of the two) so that running the
// script without env vars still behaves reasonably.
//   main:       ~2666 modules / ~12.63 MB
//   background: ~4359 modules / ~34.66 MB
const MODULE_BUDGET = parseInt(process.env.STARTUP_MODULE_BUDGET || '5000', 10);
const SIZE_BUDGET_BYTES =
  parseFloat(process.env.STARTUP_SIZE_BUDGET_MB || '38') * 1024 * 1024;

// npm packages that must NEVER appear in the main startup graph.
// Phase 1 optimization moved these to lazy / dynamic imports.
// If any creep back, a sync import was accidentally added somewhere.
const FORBIDDEN_NPM_IN_MAIN = [
  '@keystonehq/', // Hardware wallet QR SDK — lazy via qr-wallet-sdk
  '@reown/', //       WalletConnect UI — event-driven lazy mount
  '@bufbuild/protobuf', // Protobuf — transitive dep of @keystonehq
];

// npm packages that must NEVER appear in the common startup graph.
const FORBIDDEN_NPM_IN_COMMON = [
  'viem/', //   EVM library — lazy loaded by background connectors
];

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
  const entryName = process.env.ENTRY || 'main';
  const enableNativeBg = process.env.ENABLE_NATIVE_BACKGROUND_THREAD === 'true';

  console.log('=== Startup Graph Budget Check ===\n');
  console.log(`Entry:          ${entryName}`);
  console.log(`Native BG:      ${enableNativeBg}`);
  console.log(`Module budget:  ${MODULE_BUDGET}`);
  console.log(
    `Size budget:    ${(SIZE_BUDGET_BYTES / 1024 / 1024).toFixed(0)} MB\n`,
  );

  const allocationReportPath = path.resolve(
    distDir,
    `allocation-report-${entryName}.json`,
  );

  let elapsed = '0.0';
  let totalModules = 0;
  let totalSize = 0;
  let categories = {};
  let foundForbidden = [];

  if (fs.existsSync(allocationReportPath)) {
    const allocationReport = JSON.parse(
      fs.readFileSync(allocationReportPath, 'utf-8'),
    );
    const startup = allocationReport.startup || {};
    const startupModules = startup.modules || [];
    totalModules = startup.moduleCount || startupModules.length;
    totalSize = startup.estimatedSizeBytes || 0;
    categories = {};
    for (const relPath of startupModules) {
      const cat = categorizeModule(relPath);
      categories[cat] = (categories[cat] || 0) + 1;
    }
    // Skip forbidden check for background entry — services/vaults are expected
    if (entryName === 'background') {
      foundForbidden = [];
    } else if (Array.isArray(allocationReport.violations)) {
      foundForbidden = allocationReport.violations;
    } else {
      foundForbidden = startupModules.filter((relPath) =>
        FORBIDDEN_IN_STARTUP.some((forbidden) => relPath.includes(forbidden)),
      );
    }
    console.log(`Using allocation report: ${allocationReportPath}`);
  } else {
    const Metro = require('metro');
    const { loadConfig } = require('metro-config');
    const entryFile =
      entryName === 'background'
        ? path.resolve(mobileDirPath, 'background.ts')
        : path.resolve(mobileDirPath, 'index.ts');
    const config = await loadConfig({ cwd: mobileDirPath });

    const startTime = Date.now();
    const graph = await Metro.buildGraph(config, {
      entries: [entryFile],
      platform: 'ios',
      dev: false,
      minify: false,
    });
    elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const monorepoRoot = path.resolve(mobileDirPath, '../..');
    const allModules = Array.from(graph.dependencies.entries());
    totalModules = allModules.length;

    for (const [, moduleData] of allModules) {
      if (moduleData.output) {
        for (const o of moduleData.output) {
          if (o.data && o.data.code) {
            totalSize += o.data.code.length;
          }
        }
      }
    }

    categories = {};
    for (const [absPath] of allModules) {
      const rel = relativePath(absPath, monorepoRoot);
      const cat = categorizeModule(rel);
      categories[cat] = (categories[cat] || 0) + 1;
    }

    foundForbidden = [];
    if (enableNativeBg && entryName !== 'background') {
      for (const [absPath] of allModules) {
        const rel = relativePath(absPath, monorepoRoot);
        if (FORBIDDEN_IN_STARTUP.some((f) => rel.includes(f))) {
          foundForbidden.push(rel);
        }
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
  const sortedCats = Object.entries(categories).toSorted((a, b) => b[1] - a[1]);
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

  // Check forbidden npm packages (Phase 1 optimization guard)
  if (fs.existsSync(allocationReportPath)) {
    const allocationReport = JSON.parse(
      fs.readFileSync(allocationReportPath, 'utf-8'),
    );
    const startupModules = (allocationReport.startup || {}).modules || [];
    const forbiddenPatterns = entryName === 'main' ? FORBIDDEN_NPM_IN_MAIN : [];
    for (const pattern of forbiddenPatterns) {
      const matches = startupModules.filter((m) => m.includes(pattern));
      if (matches.length > 0) {
        failures.push(
          `Forbidden npm "${pattern}" found in ${entryName} startup (${matches.length} modules). A sync import of this package was re-introduced — use dynamic import() instead.`,
        );
      }
    }

    // Also check common report if it exists and we're checking main
    if (entryName === 'main') {
      const commonReportPath = path.resolve(
        distDir,
        'allocation-report-common.json',
      );
      if (fs.existsSync(commonReportPath)) {
        const commonReport = JSON.parse(
          fs.readFileSync(commonReportPath, 'utf-8'),
        );
        const commonModules = (commonReport.startup || {}).modules || [];
        for (const pattern of FORBIDDEN_NPM_IN_COMMON) {
          const matches = commonModules.filter((m) => m.includes(pattern));
          if (matches.length > 0) {
            failures.push(
              `Forbidden npm "${pattern}" found in common startup (${matches.length} modules). This package must not be eagerly loaded.`,
            );
          }
        }
      }
    }
  }

  // Check allocation report violations (Phase 4)
  if (fs.existsSync(allocationReportPath)) {
    try {
      const allocationReport = JSON.parse(
        fs.readFileSync(allocationReportPath, 'utf-8'),
      );
      // Skip violations for background entry — services/vaults are expected
      if (
        entryName !== 'background' &&
        allocationReport.violations &&
        allocationReport.violations.length > 0
      ) {
        failures.push(
          `Allocation violations (forbidden modules in startup): ${allocationReport.violations.join(', ')}`,
        );
      }
      const startup = allocationReport.startup || {};
      console.log('\nAllocation Report:');
      console.log(`  Startup modules: ${startup.moduleCount || 'N/A'}`);
      console.log(
        `  Startup size:    ${((startup.estimatedSizeBytes || 0) / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(
        `  Segments:        ${Object.keys(allocationReport.segments || {}).length}`,
      );
    } catch (e) {
      console.warn(`  Warning: Could not read allocation report: ${e.message}`);
    }
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
