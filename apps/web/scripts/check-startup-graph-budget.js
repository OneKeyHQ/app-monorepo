#!/usr/bin/env node

/**
 * Web startup graph budget CI check.
 *
 * Uses the production web build's index.html and source maps to approximate
 * the modules and package code that are eagerly loaded on first visit.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MB = 1024 * 1024;

const repoRoot = path.resolve(__dirname, '../../..');
const webDir = path.resolve(__dirname, '..');
const buildDir =
  process.env.WEB_STARTUP_BUILD_DIR ||
  process.argv[2] ||
  path.join(webDir, 'web-build');
const outDir =
  process.env.WEB_STARTUP_OUT_DIR || path.join(webDir, 'out-dir-analysis');
const reportPath =
  process.env.WEB_STARTUP_REPORT_PATH ||
  path.join(outDir, 'web-startup-graph-budget-report.json');
const budgetPath =
  process.env.WEB_STARTUP_BUDGET_PATH ||
  path.join(repoRoot, 'development', 'perf-ci', 'thresholds', 'web.cold.json');
const {
  WEB_BUDGET_ARTIFACT,
  createWebStartupAiHints,
  defaultSiblingPath,
  printAiTriageInstructions,
  writeAiHints,
} = require(path.join(repoRoot, 'development/perf-ci/lib/budgetAiHints'));
const { createStaticImportChainReport } = require(
  path.join(repoRoot, 'development/perf-ci/lib/importChain'),
);

const DEFAULT_BUDGETS = {
  moduleCount: 3500,
  sourceSizeBytes: 14 * MB,
  initialScriptCount: 45,
  initialScriptRawBytes: 7 * MB,
  initialScriptGzipBytes: 2 * MB,
  initialScriptBrotliBytes: 1600 * 1024,
  largestModuleBytes: 800 * 1024,
  allScriptRawBytes: null,
};

const DEFAULT_FORBIDDEN_SOURCES = [
  '@keystonehq/',
  '@reown/',
  '@floating-ui/react',
  'react-hook-form',
  'localforage',
  'WebStorageLegacy',
  'translations.ts',
];

class WebStartupGraphBudgetError extends Error {}

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function csvEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getExistingExtraReportPaths() {
  return csvEnv('WEB_STARTUP_EXTRA_REPORT_PATHS', []).filter((item) => {
    const fullPath = path.isAbsolute(item) ? item : path.join(repoRoot, item);
    return fs.existsSync(fullPath);
  });
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadBudgets() {
  const raw = readJsonIfExists(budgetPath);
  const config = raw?.startupGraph || raw?.webStartupGraph || {};
  return {
    ...DEFAULT_BUDGETS,
    ...config,
    moduleCount: numberEnv(
      'WEB_STARTUP_MODULE_BUDGET',
      config.moduleCount ?? DEFAULT_BUDGETS.moduleCount,
    ),
    sourceSizeBytes: numberEnv(
      'WEB_STARTUP_SOURCE_SIZE_BUDGET_BYTES',
      config.sourceSizeBytes ?? DEFAULT_BUDGETS.sourceSizeBytes,
    ),
    initialScriptCount: numberEnv(
      'WEB_STARTUP_INITIAL_SCRIPT_COUNT_BUDGET',
      config.initialScriptCount ?? DEFAULT_BUDGETS.initialScriptCount,
    ),
    initialScriptRawBytes: numberEnv(
      'WEB_STARTUP_INITIAL_SCRIPT_RAW_BUDGET_BYTES',
      config.initialScriptRawBytes ?? DEFAULT_BUDGETS.initialScriptRawBytes,
    ),
    initialScriptGzipBytes: numberEnv(
      'WEB_STARTUP_INITIAL_SCRIPT_GZIP_BUDGET_BYTES',
      config.initialScriptGzipBytes ?? DEFAULT_BUDGETS.initialScriptGzipBytes,
    ),
    initialScriptBrotliBytes: numberEnv(
      'WEB_STARTUP_INITIAL_SCRIPT_BROTLI_BUDGET_BYTES',
      config.initialScriptBrotliBytes ??
        DEFAULT_BUDGETS.initialScriptBrotliBytes,
    ),
    largestModuleBytes: numberEnv(
      'WEB_STARTUP_LARGEST_MODULE_BUDGET_BYTES',
      config.largestModuleBytes ?? DEFAULT_BUDGETS.largestModuleBytes,
    ),
    allScriptRawBytes:
      process.env.WEB_STARTUP_ALL_SCRIPT_RAW_BUDGET_BYTES !== undefined
        ? numberEnv('WEB_STARTUP_ALL_SCRIPT_RAW_BUDGET_BYTES', null)
        : (config.allScriptRawBytes ?? DEFAULT_BUDGETS.allScriptRawBytes),
  };
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (value >= MB) return `${(value / MB).toFixed(2)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${value} B`;
}

function getInitialScriptFiles(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter((src) => !/^https?:|^\/\//.test(src))
    .map((src) => src.split('?')[0].replace(/^\//, ''));
}

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(filePath);
    return filePath;
  });
}

function normalizeSource(source) {
  return source
    .replace(/^webpack:\/\/[^/]+\//, '')
    .replace(/^webpack:\/\//, '')
    .replace(/^(\.\.\/)+/, '')
    .replace(/^\.\//, '');
}

function categorizeModule(source) {
  if (source.includes('node_modules/')) return 'node_modules';
  if (source.includes('packages/components/')) return 'components';
  if (source.includes('packages/kit-bg/')) return 'kit-bg';
  if (source.includes('packages/kit/')) return 'kit';
  if (source.includes('packages/shared/')) return 'shared';
  if (source.includes('apps/web/')) return 'apps/web';
  return 'other';
}

function getPackageName(source) {
  const marker = 'node_modules/';
  const index = source.indexOf(marker);
  if (index < 0) return null;
  const parts = source.slice(index + marker.length).split('/');
  if (!parts[0]) return null;
  return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function getFileSizeRows(files) {
  return files.map((file) => {
    const filePath = path.join(buildDir, file);
    const buffer = fs.readFileSync(filePath);
    return {
      file,
      bytes: buffer.length,
      gzipBytes: zlib.gzipSync(buffer).length,
      brotliBytes: zlib.brotliCompressSync(buffer).length,
    };
  });
}

function getModuleRows(scriptFiles) {
  const modules = new Map();
  for (const file of scriptFiles) {
    const mapPath = path.join(buildDir, `${file}.map`);
    if (fs.existsSync(mapPath)) {
      const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      const sources = map.sources || [];
      const contents = map.sourcesContent || [];
      for (let index = 0; index < sources.length; index += 1) {
        const source = normalizeSource(sources[index]);
        const bytes = Buffer.byteLength(contents[index] || '');
        const existing = modules.get(source);
        if (existing) {
          existing.bytes = Math.max(existing.bytes, bytes);
          existing.files.add(file);
        } else {
          modules.set(source, {
            source,
            bytes,
            category: categorizeModule(source),
            packageName: getPackageName(source),
            files: new Set([file]),
          });
        }
      }
    }
  }

  return [...modules.values()].map((module) => ({
    ...module,
    files: [...module.files],
  }));
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function groupCount(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = row[key] || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function groupBytes(rows, key) {
  const bytes = {};
  for (const row of rows) {
    const value = row[key];
    if (value) {
      bytes[value] = (bytes[value] || 0) + row.bytes;
    }
  }
  return bytes;
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
  const htmlPath = path.join(buildDir, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    throw new WebStartupGraphBudgetError(`Missing index.html: ${htmlPath}`);
  }

  const budgetConfig = readJsonIfExists(budgetPath);
  const budgets = loadBudgets();
  const forbiddenSources = csvEnv(
    'WEB_STARTUP_FORBIDDEN_SOURCES',
    budgetConfig?.startupGraph?.forbiddenSources || DEFAULT_FORBIDDEN_SOURCES,
  );

  const html = fs.readFileSync(htmlPath, 'utf8');
  const initialScriptFiles = getInitialScriptFiles(html).filter((file) =>
    fs.existsSync(path.join(buildDir, file)),
  );
  const missingSourceMaps = initialScriptFiles.filter(
    (file) => !fs.existsSync(path.join(buildDir, `${file}.map`)),
  );
  const initialScripts = getFileSizeRows(initialScriptFiles);
  const moduleRows = getModuleRows(initialScriptFiles);
  const allScriptFiles = walkFiles(buildDir).filter(
    (file) => /\.m?js$/.test(file) && !file.endsWith('.map'),
  );
  const allScriptRawBytes = allScriptFiles.reduce(
    (total, file) => total + fs.statSync(file).size,
    0,
  );

  const sourceSizeBytes = sum(moduleRows, 'bytes');
  const summary = {
    moduleCount: moduleRows.length,
    sourceSizeBytes,
    initialScriptCount: initialScripts.length,
    initialScriptRawBytes: sum(initialScripts, 'bytes'),
    initialScriptGzipBytes: sum(initialScripts, 'gzipBytes'),
    initialScriptBrotliBytes: sum(initialScripts, 'brotliBytes'),
    allScriptCount: allScriptFiles.length,
    allScriptRawBytes,
    largestModuleBytes: Math.max(0, ...moduleRows.map((row) => row.bytes)),
    categories: groupCount(moduleRows, 'category'),
  };

  const packageBytes = groupBytes(moduleRows, 'packageName');
  const forbiddenModulesFound = moduleRows.filter((row) =>
    forbiddenSources.some((pattern) => row.source.includes(pattern)),
  );

  const budgetChecks = [
    makeBudgetCheck('moduleCount', summary.moduleCount, budgets.moduleCount),
    makeBudgetCheck(
      'sourceSizeBytes',
      summary.sourceSizeBytes,
      budgets.sourceSizeBytes,
    ),
    makeBudgetCheck(
      'initialScriptCount',
      summary.initialScriptCount,
      budgets.initialScriptCount,
    ),
    makeBudgetCheck(
      'initialScriptRawBytes',
      summary.initialScriptRawBytes,
      budgets.initialScriptRawBytes,
    ),
    makeBudgetCheck(
      'initialScriptGzipBytes',
      summary.initialScriptGzipBytes,
      budgets.initialScriptGzipBytes,
    ),
    makeBudgetCheck(
      'initialScriptBrotliBytes',
      summary.initialScriptBrotliBytes,
      budgets.initialScriptBrotliBytes,
    ),
    makeBudgetCheck(
      'largestModuleBytes',
      summary.largestModuleBytes,
      budgets.largestModuleBytes,
    ),
    makeBudgetCheck(
      'allScriptRawBytes',
      summary.allScriptRawBytes,
      budgets.allScriptRawBytes,
    ),
  ].filter((check) => check.budget !== null && check.budget !== undefined);

  const failures = budgetChecks
    .filter((check) => !check.pass)
    .map(
      (check) => `${check.name} ${check.actual} exceeds budget ${check.budget}`,
    );
  if (forbiddenModulesFound.length > 0) {
    failures.push(
      `Forbidden modules in web startup graph: ${forbiddenModulesFound
        .slice(0, 20)
        .map((row) => row.source)
        .join(', ')}`,
    );
  }
  if (missingSourceMaps.length > 0) {
    failures.push(
      `Missing source maps for initial scripts: ${missingSourceMaps.join(', ')}`,
    );
  }
  if (moduleRows.length === 0) {
    failures.push('No startup modules found. Check source map generation.');
  }

  const topModules = moduleRows
    .toSorted((a, b) => b.bytes - a.bytes)
    .slice(0, 80);
  const topPackages = Object.entries(packageBytes)
    .map(([name, bytes]) => ({ name, bytes }))
    .toSorted((a, b) => b.bytes - a.bytes)
    .slice(0, 80);
  const importChainTargets = [
    ...forbiddenModulesFound.map((row) => row.source),
    ...topModules.slice(0, 20).map((row) => row.source),
  ];
  const importChains = createStaticImportChainReport({
    repoRoot,
    modules: moduleRows.map((row) => row.source),
    roots: ['apps/web/index.js', 'apps/web/App.tsx'],
    targets: importChainTargets,
    platform: 'web',
  });

  const report = {
    createdAt: new Date().toISOString(),
    buildDir,
    budgetPath: fs.existsSync(budgetPath) ? budgetPath : null,
    budgets,
    forbiddenSources,
    missingSourceMaps,
    summary,
    budgetChecks,
    forbiddenModulesFound,
    topModules,
    topPackages,
    importChains,
    initialScripts: initialScripts.toSorted((a, b) => b.bytes - a.bytes),
    pass: failures.length === 0,
    failures,
  };
  const aiHints = createWebStartupAiHints({
    report,
    moduleRows,
    initialScripts,
    buildDir,
    repoRoot,
  });
  const aiHintsJsonPath =
    process.env.WEB_STARTUP_AI_HINTS_JSON_PATH ||
    defaultSiblingPath(reportPath, '-ai-hints.json');
  const aiHintsMarkdownPath =
    process.env.WEB_STARTUP_AI_HINTS_MD_PATH ||
    defaultSiblingPath(reportPath, '-ai-hints.md');

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  writeAiHints({
    hints: aiHints,
    jsonPath: aiHintsJsonPath,
    markdownPath: aiHintsMarkdownPath,
  });

  console.log('=== Web Startup Graph Budget Check ===\n');
  console.log(`Build dir:              ${buildDir}`);
  console.log(`Initial scripts:        ${summary.initialScriptCount}`);
  console.log(`Startup modules:        ${summary.moduleCount}`);
  console.log(
    `Startup source size:    ${formatBytes(summary.sourceSizeBytes)}`,
  );
  console.log(
    `Initial raw/gzip/br:    ${formatBytes(
      summary.initialScriptRawBytes,
    )} / ${formatBytes(summary.initialScriptGzipBytes)} / ${formatBytes(
      summary.initialScriptBrotliBytes,
    )}`,
  );
  console.log(
    `All JS files/raw size:  ${summary.allScriptCount} / ${formatBytes(
      summary.allScriptRawBytes,
    )}`,
  );
  console.log('\nCategories:');
  for (const [category, count] of Object.entries(summary.categories).toSorted(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${category.padEnd(20)} ${count}`);
  }

  console.log('\nTop packages:');
  for (const item of report.topPackages.slice(0, 20)) {
    console.log(`  ${formatBytes(item.bytes).padStart(10)} ${item.name}`);
  }

  console.log('\nBudgets:');
  for (const check of budgetChecks) {
    const format =
      check.name.endsWith('Bytes') || check.name.includes('Raw')
        ? formatBytes
        : (value) => String(value);
    console.log(
      `  ${check.pass ? 'PASS' : 'FAIL'} ${check.name}: ${format(
        check.actual,
      )} / ${format(check.budget)}`,
    );
  }

  if (forbiddenModulesFound.length > 0) {
    console.log('\nForbidden modules:');
    for (const row of forbiddenModulesFound.slice(0, 30)) {
      console.log(`  ${row.source}`);
    }
  }

  console.log(`\nReport: ${reportPath}`);
  console.log(`AI hints JSON: ${aiHintsJsonPath}`);
  console.log(`AI hints Markdown: ${aiHintsMarkdownPath}`);

  if (failures.length > 0 && process.env.WEB_STARTUP_BUDGET_FAIL !== '0') {
    console.log('\n=== WEB STARTUP GRAPH BUDGET CHECK FAILED ===');
    for (const failure of failures) {
      console.log(`  FAIL: ${failure}`);
    }
    printAiTriageInstructions({
      artifactName: WEB_BUDGET_ARTIFACT,
      aiHintsJsonPath,
      aiHintsMarkdownPath,
      reportPath,
      extraPaths: getExistingExtraReportPaths(),
      notes: [
        'Fix startup graph and web cold budgets together; avoid creating many one-file lazy chunks.',
        'Read initialScriptHints and topModules in the JSON before editing imports.',
      ],
      log: console.log,
    });
    process.exit(1);
  }

  console.log('\n=== WEB STARTUP GRAPH BUDGET CHECK PASSED ===');
}

main();
