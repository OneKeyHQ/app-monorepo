#!/usr/bin/env node

/**
 * Desktop main/preload bundle budget CI check.
 *
 * Uses the esbuild metafile from `ESBUILD_METAFILE=1 yarn build:main` plus
 * actual output bytes to guard Electron node-layer cold-start parse cost.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MB = 1024 * 1024;

const repoRoot = path.resolve(__dirname, '../../..');
const desktopDir = path.resolve(__dirname, '..');
const distDir =
  process.env.DESKTOP_MAIN_DIST_DIR ||
  process.argv[2] ||
  path.join(desktopDir, 'app', 'dist');
const metaPath =
  process.env.DESKTOP_MAIN_META_PATH || path.join(distDir, 'meta.json');
const outDir =
  process.env.DESKTOP_MAIN_BUDGET_OUT_DIR ||
  path.join(desktopDir, 'out-dir-analysis');
const reportPath =
  process.env.DESKTOP_MAIN_BUDGET_REPORT_PATH ||
  path.join(outDir, 'desktop-main-bundle-budget-report.json');
const budgetPath =
  process.env.DESKTOP_STARTUP_BUDGET_PATH ||
  path.join(
    repoRoot,
    'development',
    'perf-ci',
    'thresholds',
    'desktop.startup.json',
  );

const DEFAULT_BUDGETS = {
  appRawBytes: 8 * MB,
  appGzipBytes: 2 * MB,
  appBrotliBytes: 1536 * 1024,
  preloadRawBytes: 96 * 1024,
  preloadGzipBytes: 32 * 1024,
  serviceIndexRawBytes: 128 * 1024,
  largestInputBytes: 3 * MB,
  forbiddenBundledInputs: [
    'node_modules/@sentry/electron',
    'node_modules/electron-updater',
    'node_modules/adm-zip',
    'node_modules/systeminformation',
    'node_modules/iconv-lite',
    'packages/shared/src/locale/json/',
  ],
  maxInputBytesBySource: [],
};

class DesktopMainBundleBudgetError extends Error {}

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadBudgets() {
  const raw = readJsonIfExists(budgetPath);
  const config = raw?.mainBundle || raw?.desktopMainBundle || {};
  return {
    ...DEFAULT_BUDGETS,
    ...config,
    appRawBytes: numberEnv(
      'DESKTOP_MAIN_APP_RAW_BUDGET_BYTES',
      config.appRawBytes ?? DEFAULT_BUDGETS.appRawBytes,
    ),
    appGzipBytes: numberEnv(
      'DESKTOP_MAIN_APP_GZIP_BUDGET_BYTES',
      config.appGzipBytes ?? DEFAULT_BUDGETS.appGzipBytes,
    ),
    appBrotliBytes: numberEnv(
      'DESKTOP_MAIN_APP_BROTLI_BUDGET_BYTES',
      config.appBrotliBytes ?? DEFAULT_BUDGETS.appBrotliBytes,
    ),
    preloadRawBytes: numberEnv(
      'DESKTOP_MAIN_PRELOAD_RAW_BUDGET_BYTES',
      config.preloadRawBytes ?? DEFAULT_BUDGETS.preloadRawBytes,
    ),
    preloadGzipBytes: numberEnv(
      'DESKTOP_MAIN_PRELOAD_GZIP_BUDGET_BYTES',
      config.preloadGzipBytes ?? DEFAULT_BUDGETS.preloadGzipBytes,
    ),
    serviceIndexRawBytes: numberEnv(
      'DESKTOP_MAIN_SERVICE_INDEX_RAW_BUDGET_BYTES',
      config.serviceIndexRawBytes ?? DEFAULT_BUDGETS.serviceIndexRawBytes,
    ),
    largestInputBytes: numberEnv(
      'DESKTOP_MAIN_LARGEST_INPUT_BUDGET_BYTES',
      config.largestInputBytes ?? DEFAULT_BUDGETS.largestInputBytes,
    ),
  };
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (value >= MB) return `${(value / MB).toFixed(2)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${value} B`;
}

function readFileStats(relativeOutputPath) {
  const filePath = path.join(distDir, relativeOutputPath);
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return {
    file: relativeOutputPath,
    bytes: buffer.length,
    gzipBytes: zlib.gzipSync(buffer).length,
    brotliBytes: zlib.brotliCompressSync(buffer).length,
  };
}

function outputFor(meta, outputPath) {
  return meta.outputs?.[`app/dist/${outputPath}`] || null;
}

function normalizeInputPath(input) {
  return input.replaceAll(path.sep, '/').replace(/^(\.\.\/)+/, '');
}

function getTopInputs(output) {
  return Object.entries(output?.inputs || {})
    .map(([source, value]) => ({
      source: normalizeInputPath(source),
      bytesInOutput: value.bytesInOutput || 0,
    }))
    .toSorted((a, b) => b.bytesInOutput - a.bytesInOutput);
}

function getForbiddenBundledInputs(topInputs, patterns) {
  return topInputs.filter((input) =>
    patterns.some((pattern) => input.source.includes(pattern)),
  );
}

function getInputBudgetChecks(topInputs, inputBudgets) {
  return (inputBudgets || []).map((item) => {
    const matches = topInputs.filter((input) =>
      input.source.includes(item.pattern),
    );
    const actual = matches.reduce(
      (max, input) => Math.max(max, input.bytesInOutput),
      0,
    );
    return {
      name: `input:${item.pattern}`,
      actual,
      budget: item.bytes,
      matches,
      pass: actual <= item.bytes,
    };
  });
}

function makeBudgetCheck(name, actual, budget) {
  return {
    name,
    actual,
    budget,
    pass:
      budget === null ||
      budget === undefined ||
      (Number.isFinite(actual) && actual <= budget),
  };
}

function main() {
  if (!fs.existsSync(metaPath)) {
    throw new DesktopMainBundleBudgetError(
      `Missing esbuild metafile: ${metaPath}. Run build:main with ESBUILD_METAFILE=1.`,
    );
  }

  const budgetConfig = readJsonIfExists(budgetPath);
  const budgets = loadBudgets();
  const meta = readJsonIfExists(metaPath);

  const appStats = readFileStats('app.js');
  const preloadStats = readFileStats('preload.js');
  const serviceIndexStats = readFileStats('service/index.js');
  if (!appStats || !preloadStats) {
    throw new DesktopMainBundleBudgetError(
      `Missing required desktop main outputs in ${distDir}`,
    );
  }

  const appOutput = outputFor(meta, 'app.js');
  const topInputs = getTopInputs(appOutput);
  const largestInputBytes = topInputs[0]?.bytesInOutput || 0;
  const forbiddenBundledInputs = getForbiddenBundledInputs(
    topInputs,
    budgets.forbiddenBundledInputs,
  );
  const inputBudgetChecks = getInputBudgetChecks(
    topInputs,
    budgets.maxInputBytesBySource,
  );

  const summary = {
    appRawBytes: appStats.bytes,
    appGzipBytes: appStats.gzipBytes,
    appBrotliBytes: appStats.brotliBytes,
    preloadRawBytes: preloadStats.bytes,
    preloadGzipBytes: preloadStats.gzipBytes,
    preloadBrotliBytes: preloadStats.brotliBytes,
    serviceIndexRawBytes: serviceIndexStats?.bytes || 0,
    largestInputBytes,
  };

  const budgetChecks = [
    makeBudgetCheck('appRawBytes', summary.appRawBytes, budgets.appRawBytes),
    makeBudgetCheck('appGzipBytes', summary.appGzipBytes, budgets.appGzipBytes),
    makeBudgetCheck(
      'appBrotliBytes',
      summary.appBrotliBytes,
      budgets.appBrotliBytes,
    ),
    makeBudgetCheck(
      'preloadRawBytes',
      summary.preloadRawBytes,
      budgets.preloadRawBytes,
    ),
    makeBudgetCheck(
      'preloadGzipBytes',
      summary.preloadGzipBytes,
      budgets.preloadGzipBytes,
    ),
    makeBudgetCheck(
      'serviceIndexRawBytes',
      summary.serviceIndexRawBytes,
      budgets.serviceIndexRawBytes,
    ),
    makeBudgetCheck(
      'largestInputBytes',
      summary.largestInputBytes,
      budgets.largestInputBytes,
    ),
    ...inputBudgetChecks,
  ].filter((check) => check.budget !== null && check.budget !== undefined);

  const failures = budgetChecks
    .filter((check) => !check.pass)
    .map(
      (check) => `${check.name} ${check.actual} exceeds budget ${check.budget}`,
    );
  if (forbiddenBundledInputs.length > 0) {
    failures.push(
      `Forbidden inputs bundled into desktop app.js: ${forbiddenBundledInputs
        .slice(0, 20)
        .map((input) => input.source)
        .join(', ')}`,
    );
  }

  const report = {
    createdAt: new Date().toISOString(),
    distDir,
    metaPath,
    budgetPath: fs.existsSync(budgetPath) ? budgetPath : null,
    budgets,
    summary,
    budgetChecks,
    forbiddenBundledInputs,
    topInputs: topInputs.slice(0, 80),
    outputs: {
      app: appStats,
      preload: preloadStats,
      serviceIndex: serviceIndexStats,
    },
    externalImports: (appOutput?.imports || [])
      .filter((item) => item.external)
      .map((item) => item.path),
    pass: failures.length === 0,
    failures,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log('=== Desktop Main Bundle Budget Check ===\n');
  console.log(`Dist dir:               ${distDir}`);
  console.log(
    `app.js raw/gzip/br:    ${formatBytes(summary.appRawBytes)} / ${formatBytes(
      summary.appGzipBytes,
    )} / ${formatBytes(summary.appBrotliBytes)}`,
  );
  console.log(
    `preload raw/gzip/br:   ${formatBytes(
      summary.preloadRawBytes,
    )} / ${formatBytes(summary.preloadGzipBytes)} / ${formatBytes(
      summary.preloadBrotliBytes,
    )}`,
  );
  console.log(
    `service/index.js raw:  ${formatBytes(summary.serviceIndexRawBytes)}`,
  );

  console.log('\nTop app.js inputs:');
  for (const item of topInputs.slice(0, 20)) {
    console.log(
      `  ${formatBytes(item.bytesInOutput).padStart(10)} ${item.source}`,
    );
  }

  console.log('\nBudgets:');
  for (const check of budgetChecks) {
    console.log(
      `  ${check.pass ? 'PASS' : 'FAIL'} ${check.name}: ${formatBytes(
        check.actual,
      )} / ${formatBytes(check.budget)}`,
    );
  }

  if (forbiddenBundledInputs.length > 0) {
    console.log('\nForbidden bundled inputs:');
    for (const input of forbiddenBundledInputs.slice(0, 30)) {
      console.log(`  ${input.source}`);
    }
  }

  console.log(`\nReport: ${reportPath}`);

  if (failures.length > 0 && process.env.DESKTOP_MAIN_BUDGET_FAIL !== '0') {
    console.log('\n=== DESKTOP MAIN BUNDLE BUDGET CHECK FAILED ===');
    for (const failure of failures) {
      console.log(`  FAIL: ${failure}`);
    }
    process.exit(1);
  }

  console.log('\n=== DESKTOP MAIN BUNDLE BUDGET CHECK PASSED ===');
}

main();
