const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const MB = 1024 * 1024;

function formatBytes(value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (value >= MB) return `${(value / MB).toFixed(2)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${value} B`;
}

function formatValue(name, value) {
  if (name.endsWith('Bytes') || name.includes('Size')) {
    return formatBytes(value);
  }
  if (name.endsWith('Ms')) {
    return Number.isFinite(value) ? `${Math.round(value)} ms` : 'n/a';
  }
  return Number.isFinite(value) ? String(value) : 'n/a';
}

function limitRows(rows, limit) {
  return rows.slice(0, limit);
}

function safeReadJson(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function safeExec(repoRoot, command) {
  try {
    return childProcess
      .execSync(command, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      .trim();
  } catch {
    return '';
  }
}

function getGitContext(repoRoot) {
  const headSha =
    process.env.GITHUB_SHA || safeExec(repoRoot, 'git rev-parse HEAD');
  const baseRef = process.env.GITHUB_BASE_REF || '';
  const headRef = process.env.GITHUB_HEAD_REF || '';
  const baseSha = process.env.GITHUB_BASE_SHA || '';
  let changedFiles = [];
  const diffBase =
    baseSha ||
    (baseRef
      ? safeExec(repoRoot, `git merge-base HEAD origin/${baseRef}`)
      : '');
  if (diffBase) {
    changedFiles = safeExec(
      repoRoot,
      `git diff --name-only ${diffBase}...HEAD`,
    )
      .split('\n')
      .filter(Boolean)
      .slice(0, 200);
  }
  return {
    headSha,
    baseRef,
    headRef,
    baseSha: diffBase,
    changedFiles,
  };
}

function normalizeSource(source) {
  return String(source || '')
    .replace(/^webpack:\/\/[^/]+\//, '')
    .replace(/^webpack:\/\//, '')
    .replace(/^(\.\.\/)+/, '')
    .replace(/^\.\//, '');
}

function categorizeSource(source) {
  if (source.includes('node_modules/')) return 'node_modules';
  if (source.includes('packages/components/')) return 'components';
  if (source.includes('packages/kit-bg/')) return 'kit-bg';
  if (source.includes('packages/kit/')) return 'kit';
  if (source.includes('packages/shared/')) return 'shared';
  if (source.includes('apps/web/')) return 'apps/web';
  if (source.includes('apps/mobile/')) return 'apps/mobile';
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

function countBy(rows, getKey) {
  const counts = {};
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function modulePrefix(modulePath) {
  const parts = String(modulePath || '').split('/');
  if (parts[0] === 'node_modules') {
    const packageName = getPackageName(modulePath);
    return packageName ? `node_modules/${packageName}` : 'node_modules';
  }
  if (parts[0] === 'packages') return parts.slice(0, 4).join('/');
  if (parts[0] === 'apps') return parts.slice(0, 4).join('/');
  return parts.slice(0, 3).join('/');
}

function normalizeScriptUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return String(url || '').split('?')[0];
  }
}

function scriptPathFromUrl(buildDir, url) {
  const pathname = normalizeScriptUrl(url);
  const relPath = decodeURIComponent(pathname).replace(/^\//, '');
  const filePath = path.join(buildDir, relPath);
  return {
    pathname,
    relPath,
    filePath,
    mapPath: `${filePath}.map`,
  };
}

function summarizeWebScript({ buildDir, script, maxSources = 30 }) {
  const paths = scriptPathFromUrl(buildDir, script.url || script);
  const exists = fs.existsSync(paths.filePath);
  const bytes = exists ? fs.statSync(paths.filePath).size : null;
  const map = safeReadJson(paths.mapPath);
  const sources = (map?.sources || []).map(normalizeSource);
  const packageCounts = countBy(sources, getPackageName).slice(0, 12);
  const categoryCounts = countBy(sources, categorizeSource).slice(0, 12);
  return {
    url: script.url || script,
    pathname: paths.pathname,
    relPath: paths.relPath,
    bytes,
    decodedBodySize: script.decodedBodySize,
    transferSize: script.transferSize,
    startTime: script.startTime,
    duration: script.duration,
    hasSourceMap: Boolean(map),
    sourceCount: sources.length,
    categoryCounts,
    packageCounts,
    sourcesSample: sources.slice(0, maxSources),
  };
}

function representativeRun(runs) {
  if (!runs.length) return null;
  const sorted = [...runs].toSorted(
    (a, b) => (a.jsDecodedBytes || 0) - (b.jsDecodedBytes || 0),
  );
  return sorted[Math.floor(sorted.length / 2)] || runs[0];
}

function duplicateScriptsForRun(run) {
  const counts = {};
  for (const script of run?.scripts || []) {
    const key = normalizeScriptUrl(script.url);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([url, count]) => ({ url, count }))
    .toSorted((a, b) => b.count - a.count || a.url.localeCompare(b.url));
}

function failedBudgetChecks(checks) {
  return (checks || [])
    .filter((check) => !check.pass || check.status === 'warn')
    .map((check) => ({
      name: check.name,
      status: check.status || (check.pass ? 'pass' : 'fail'),
      actual: check.actual,
      budget: check.budget,
      delta:
        Number.isFinite(check.actual) && Number.isFinite(check.budget)
          ? check.actual - check.budget
          : null,
    }));
}

function createWebColdAiHints({ report, buildDir, repoRoot }) {
  const scenarioScriptSets = new Map();
  for (const scenario of report.scenarios || []) {
    const run = representativeRun(scenario.runs || []);
    scenarioScriptSets.set(
      scenario.name,
      new Set((run?.scripts || []).map((script) => normalizeScriptUrl(script.url))),
    );
  }

  const scenarios = (report.scenarios || []).map((scenario) => {
    const run = representativeRun(scenario.runs || []);
    const scripts = run?.scripts || [];
    const uniqueScripts = [...new Set(scripts.map((script) => normalizeScriptUrl(script.url)))];
    const otherScripts = new Set();
    for (const [name, scriptSet] of scenarioScriptSets.entries()) {
      if (name === scenario.name) continue;
      for (const script of scriptSet) otherScripts.add(script);
    }
    const scenarioOnlyScripts = scripts.filter(
      (script) => !otherScripts.has(normalizeScriptUrl(script.url)),
    );
    const smallScripts = scripts
      .map((script) => summarizeWebScript({ buildDir, script, maxSources: 20 }))
      .filter((script) => Number.isFinite(script.bytes) && script.bytes <= 10 * 1024)
      .toSorted((a, b) => (a.bytes || 0) - (b.bytes || 0));
    return {
      name: scenario.name,
      path: scenario.path,
      summary: scenario.summary,
      failedOrWarnBudgetChecks: failedBudgetChecks(scenario.budgetChecks),
      failedHealthChecks: (scenario.healthChecks || []).filter(
        (check) => !check.pass,
      ),
      representativeRunIndex: run?.runIndex || null,
      scriptCount: run?.scriptCount || null,
      uniqueScriptCount: uniqueScripts.length,
      duplicateScripts: duplicateScriptsForRun(run).slice(0, 30),
      topScriptsByDecodedSize: (run?.topScripts || [])
        .slice(0, 12)
        .map((script) => summarizeWebScript({ buildDir, script, maxSources: 12 })),
      smallScriptCandidates: smallScripts.slice(0, 30),
      scenarioOnlyScriptCandidates: scenarioOnlyScripts
        .map((script) => summarizeWebScript({ buildDir, script, maxSources: 20 }))
        .toSorted((a, b) => (a.bytes || 0) - (b.bytes || 0))
        .slice(0, 30),
    };
  });

  return {
    kind: 'web-cold-budget',
    createdAt: new Date().toISOString(),
    git: getGitContext(repoRoot),
    reportPath: report.reportPath || null,
    buildDir,
    command:
      "PERF_WEB_COLD_SCENARIOS='<failed scenarios>' yarn perf:web:cold",
    aiFixPrompt: [
      'Fix the OneKey web cold/startup budget without relaxing thresholds.',
      'Start from failedOrWarnBudgetChecks, then inspect duplicateScripts, scenarioOnlyScriptCandidates, and smallScriptCandidates.',
      'For scriptCount/resourceCount failures, prefer merging related lazy import() boundaries or delaying non-first-screen providers.',
      'Preserve mount delays, side effects, routing behavior, and visible UI behavior.',
      'Validate with the focused PERF_WEB_COLD_SCENARIOS command plus yarn tsc:staged and yarn lint:staged.',
    ],
    scenarios,
  };
}

function createWebStartupAiHints({
  report,
  moduleRows,
  initialScripts,
  buildDir,
  repoRoot,
}) {
  const initialScriptHints = (initialScripts || []).map((script) => {
    const modules = moduleRows.filter((row) => row.files.includes(script.file));
    return {
      file: script.file,
      bytes: script.bytes,
      gzipBytes: script.gzipBytes,
      brotliBytes: script.brotliBytes,
      moduleCount: modules.length,
      categoryCounts: countBy(modules, (row) => row.category).slice(0, 12),
      packageCounts: countBy(modules, (row) => row.packageName).slice(0, 12),
      topModules: modules
        .toSorted((a, b) => b.bytes - a.bytes)
        .slice(0, 20)
        .map((row) => ({
          source: row.source,
          bytes: row.bytes,
          category: row.category,
          packageName: row.packageName,
        })),
    };
  });

  return {
    kind: 'web-startup-graph-budget',
    createdAt: new Date().toISOString(),
    git: getGitContext(repoRoot),
    buildDir,
    failedBudgetChecks: failedBudgetChecks(report.budgetChecks),
    failures: report.failures,
    summary: report.summary,
    budgets: report.budgets,
    aiFixPrompt: [
      'Fix the OneKey web startup graph budget without relaxing thresholds.',
      'Inspect failedBudgetChecks, then topModules, topPackages, and initialScriptHints.',
      'If initialScriptCount or startup module count grows, move non-first-screen imports behind lazy import() boundaries.',
      'If allScriptRawBytes grows, inspect newly created chunks and avoid one-file lazy chunks when related modules can share one lazy entry.',
      'Validate with yarn perf:web:cold or apps/web/scripts/check-startup-graph-budget.js against the production build.',
    ],
    topModules: report.topModules,
    topPackages: report.topPackages,
    forbiddenModulesFound: report.forbiddenModulesFound,
    missingSourceMaps: report.missingSourceMaps,
    initialScriptHints,
  };
}

function createNativeStartupAiHints({
  report,
  allocationReport,
  commonAllocationReport,
  repoRoot,
}) {
  const startupModules = allocationReport?.startup?.modules || [];
  const commonStartupModules = commonAllocationReport?.startup?.modules || [];
  const segmentRows = Object.entries(allocationReport?.segments || {}).map(
    ([name, segment]) => ({
      name,
      runtime: segment.runtime,
      runtimes: segment.runtimes,
      moduleCount: segment.moduleCount,
      size: segment.size,
    }),
  );

  return {
    kind: 'native-startup-graph-budget',
    createdAt: new Date().toISOString(),
    git: getGitContext(repoRoot),
    entry: report.entry,
    runtimeScope:
      report.entry === 'background'
        ? 'background JS runtime'
        : 'main UI JS runtime',
    nativeResourceNote:
      'This report describes JS bundle startup graphs. It does not imply JS heap sharing; production main/background JS runtimes are isolated even when native resources live in the same process.',
    failedBudgetChecks: failedBudgetChecks([
      {
        name: 'moduleCount',
        actual: report.totalModules,
        budget: report.moduleBudget,
        pass: report.totalModules <= report.moduleBudget,
      },
      {
        name: 'estimatedCodeSizeBytes',
        actual: report.estimatedCodeSizeBytes,
        budget: report.sizeBudgetBytes,
        pass: report.estimatedCodeSizeBytes <= report.sizeBudgetBytes,
      },
    ]),
    failures: report.failures,
    summary: {
      totalModules: report.totalModules,
      moduleBudget: report.moduleBudget,
      estimatedCodeSizeBytes: report.estimatedCodeSizeBytes,
      sizeBudgetBytes: report.sizeBudgetBytes,
      categories: report.categories,
      segmentCount: segmentRows.length,
    },
    aiFixPrompt: [
      'Fix the OneKey native startup graph budget without relaxing thresholds.',
      'Label runtime impact explicitly: main UI JS runtime, background JS runtime, or both.',
      'Use startupPackageCounts, startupPrefixCounts, and forbiddenModulesFound to find the dependency chain that entered startup.',
      'Move non-startup work behind lazy segments or runtime-specific imports while preserving main/background isolation.',
      'Validate the affected ENTRY with ENABLE_NATIVE_BACKGROUND_THREAD=true and the same STARTUP_* budget env vars from CI.',
    ],
    forbiddenModulesFound: report.forbiddenModulesFound,
    startupPackageCounts: countBy(startupModules, getPackageName).slice(0, 30),
    startupPrefixCounts: countBy(startupModules, modulePrefix).slice(0, 50),
    startupModulesSample: startupModules.slice(0, 200),
    commonStartupPrefixCounts: countBy(commonStartupModules, modulePrefix).slice(
      0,
      30,
    ),
    topSegmentsBySize: segmentRows
      .toSorted((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 30),
    topSegmentsByModuleCount: segmentRows
      .toSorted((a, b) => (b.moduleCount || 0) - (a.moduleCount || 0))
      .slice(0, 30),
  };
}

function markdownBudgetRows(checks) {
  if (!checks?.length) return '- No failed or warning budget checks.';
  return checks
    .map((check) => {
      const actual = formatValue(check.name, check.actual);
      const budget = formatValue(check.name, check.budget);
      const delta = Number.isFinite(check.delta)
        ? `, delta ${formatValue(check.name, check.delta)}`
        : '';
      return `- ${check.status || 'fail'} ${check.name}: ${actual} / ${budget}${delta}`;
    })
    .join('\n');
}

function renderAiHintsMarkdown(hints) {
  const lines = [
    `# ${hints.kind}`,
    '',
    `Created at: ${hints.createdAt}`,
    `Head SHA: ${hints.git?.headSha || 'unknown'}`,
  ];
  if (hints.git?.baseRef) lines.push(`Base ref: ${hints.git.baseRef}`);
  if (hints.entry) lines.push(`Entry: ${hints.entry}`);
  if (hints.runtimeScope) lines.push(`Runtime scope: ${hints.runtimeScope}`);
  if (hints.nativeResourceNote) {
    lines.push('', '## Runtime Note', hints.nativeResourceNote);
  }
  lines.push('', '## AI Fix Prompt');
  for (const item of hints.aiFixPrompt || []) lines.push(`- ${item}`);
  lines.push('', '## Failed or Warning Budgets');
  lines.push(markdownBudgetRows(hints.failedBudgetChecks));
  if (hints.scenarios?.length) {
    lines.push('', '## Scenarios');
    for (const scenario of hints.scenarios) {
      lines.push('', `### ${scenario.name}`);
      lines.push(markdownBudgetRows(scenario.failedOrWarnBudgetChecks));
      lines.push(
        `- scripts: ${scenario.scriptCount}, unique scripts: ${scenario.uniqueScriptCount}`,
      );
      if (scenario.duplicateScripts?.length) {
        lines.push('- duplicate scripts:');
        for (const item of limitRows(scenario.duplicateScripts, 10)) {
          lines.push(`  - ${item.count}x ${item.url}`);
        }
      }
      if (scenario.scenarioOnlyScriptCandidates?.length) {
        lines.push('- scenario-only small/loaded script candidates:');
        for (const item of limitRows(
          scenario.scenarioOnlyScriptCandidates,
          10,
        )) {
          lines.push(
            `  - ${formatBytes(item.bytes)} ${item.pathname} (${item.sourceCount} sources)`,
          );
        }
      }
      if (scenario.smallScriptCandidates?.length) {
        lines.push('- small script candidates:');
        for (const item of limitRows(scenario.smallScriptCandidates, 10)) {
          lines.push(
            `  - ${formatBytes(item.bytes)} ${item.pathname} (${item.sourceCount} sources)`,
          );
        }
      }
    }
  }
  if (hints.topPackages?.length) {
    lines.push('', '## Top Packages');
    for (const item of limitRows(hints.topPackages, 20)) {
      lines.push(`- ${formatBytes(item.bytes)} ${item.name}`);
    }
  }
  if (hints.startupPackageCounts?.length) {
    lines.push('', '## Startup Package Counts');
    for (const item of limitRows(hints.startupPackageCounts, 20)) {
      lines.push(`- ${item.count} ${item.name}`);
    }
  }
  if (hints.startupPrefixCounts?.length) {
    lines.push('', '## Startup Prefix Counts');
    for (const item of limitRows(hints.startupPrefixCounts, 20)) {
      lines.push(`- ${item.count} ${item.name}`);
    }
  }
  if (hints.failures?.length) {
    lines.push('', '## Raw Failures');
    for (const failure of hints.failures) lines.push(`- ${failure}`);
  }
  if (hints.git?.changedFiles?.length) {
    lines.push('', '## Changed Files');
    for (const file of limitRows(hints.git.changedFiles, 80)) {
      lines.push(`- ${file}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeAiHints({ hints, jsonPath, markdownPath }) {
  if (jsonPath) {
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, `${JSON.stringify(hints, null, 2)}\n`);
  }
  if (markdownPath) {
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderAiHintsMarkdown(hints));
  }
}

function defaultSiblingPath(filePath, suffix) {
  return filePath.replace(/\.json$/i, suffix);
}

module.exports = {
  createNativeStartupAiHints,
  createWebColdAiHints,
  createWebStartupAiHints,
  defaultSiblingPath,
  formatBytes,
  writeAiHints,
};
