const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const MB = 1024 * 1024;
const WEB_BUDGET_ARTIFACT = 'web-startup-cold-budget-reports';
const NATIVE_BUDGET_ARTIFACT = 'bundle-architecture-reports';

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
    changedFiles = safeExec(repoRoot, `git diff --name-only ${diffBase}...HEAD`)
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
    if (key) {
      counts[key] = (counts[key] || 0) + 1;
    }
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

function summarizeWebScript({
  buildDir,
  script,
  maxSources = 30,
  scriptSummaryCache,
}) {
  const paths = scriptPathFromUrl(buildDir, script.url || script);
  let cached = scriptSummaryCache?.get(paths.filePath);
  if (!cached) {
    const exists = fs.existsSync(paths.filePath);
    const bytes = exists ? fs.statSync(paths.filePath).size : null;
    const map = safeReadJson(paths.mapPath);
    const sources = (map?.sources || []).map(normalizeSource);
    cached = {
      pathname: paths.pathname,
      relPath: paths.relPath,
      bytes,
      hasSourceMap: Boolean(map),
      sourceCount: sources.length,
      categoryCounts: countBy(sources, categorizeSource).slice(0, 12),
      packageCounts: countBy(sources, getPackageName).slice(0, 12),
      sources,
    };
    scriptSummaryCache?.set(paths.filePath, cached);
  }
  return {
    url: script.url || script,
    pathname: cached.pathname,
    relPath: cached.relPath,
    bytes: cached.bytes,
    decodedBodySize: script.decodedBodySize,
    transferSize: script.transferSize,
    startTime: script.startTime,
    duration: script.duration,
    hasSourceMap: cached.hasSourceMap,
    sourceCount: cached.sourceCount,
    categoryCounts: cached.categoryCounts,
    packageCounts: cached.packageCounts,
    sourcesSample: cached.sources.slice(0, maxSources),
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
  for (const script of run?.rawScripts || run?.scripts || []) {
    const key = normalizeScriptUrl(script.url);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([url, count]) => ({ url, count }))
    .toSorted((a, b) => b.count - a.count || a.url.localeCompare(b.url));
}

function diagnosticScriptsForRun(run) {
  return run?.uniqueScripts || run?.scripts || [];
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
  const scriptSummaryCache = new Map();
  const scenarioScriptSets = new Map();
  for (const scenario of report.scenarios || []) {
    const run = representativeRun(scenario.runs || []);
    const scripts = diagnosticScriptsForRun(run);
    scenarioScriptSets.set(
      scenario.name,
      new Set(scripts.map((script) => normalizeScriptUrl(script.url))),
    );
  }

  const scenarios = (report.scenarios || []).map((scenario) => {
    const run = representativeRun(scenario.runs || []);
    const scripts = diagnosticScriptsForRun(run);
    const uniqueScripts = [
      ...new Set(scripts.map((script) => normalizeScriptUrl(script.url))),
    ];
    const otherScripts = new Set();
    for (const [name, scriptSet] of scenarioScriptSets.entries()) {
      if (name !== scenario.name) {
        for (const script of scriptSet) otherScripts.add(script);
      }
    }
    const scenarioOnlyScripts = scripts.filter(
      (script) => !otherScripts.has(normalizeScriptUrl(script.url)),
    );
    const smallScripts = scripts
      .map((script) =>
        summarizeWebScript({
          buildDir,
          script,
          maxSources: 20,
          scriptSummaryCache,
        }),
      )
      .filter(
        (script) => Number.isFinite(script.bytes) && script.bytes <= 10 * 1024,
      )
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
      scriptCount: run?.scriptCount ?? null,
      rawResourceCount: run?.rawResourceCount ?? null,
      rawScriptEntryCount: run?.rawScriptEntryCount ?? null,
      uniqueResourceCount: run?.uniqueResourceCount ?? null,
      uniqueScriptCount: run?.uniqueScriptCount ?? uniqueScripts.length,
      uniqueJsDecodedBytes: run?.uniqueJsDecodedBytes ?? null,
      duplicateScripts: duplicateScriptsForRun(run).slice(0, 30),
      topScriptsByDecodedSize: (run?.topScripts || [])
        .slice(0, 12)
        .map((script) =>
          summarizeWebScript({
            buildDir,
            script,
            maxSources: 12,
            scriptSummaryCache,
          }),
        ),
      smallScriptCandidates: smallScripts.slice(0, 30),
      scenarioOnlyScriptCandidates: scenarioOnlyScripts
        .map((script) =>
          summarizeWebScript({
            buildDir,
            script,
            maxSources: 20,
            scriptSummaryCache,
          }),
        )
        .toSorted((a, b) => (a.bytes || 0) - (b.bytes || 0))
        .slice(0, 30),
    };
  });

  return {
    kind: 'web-cold-budget',
    createdAt: new Date().toISOString(),
    git: getGitContext(repoRoot),
    artifactName: WEB_BUDGET_ARTIFACT,
    artifactInstructions: [
      `Download GitHub Actions artifact "${WEB_BUDGET_ARTIFACT}".`,
      'Read web-cold-budget-report-ai-hints.json first; Markdown is only a summary.',
      'Cross-check web-cold-budget-report.json for raw runs, all scenarios, and health checks before editing.',
    ],
    reportNotes: [
      report.legacyTopLevelFieldsNote ||
        'Use scenarios[] as the source of truth. Top-level summary/budgetChecks/runs are legacy-compatible fields for the first scenario only.',
      report.metricDefinitions?.resourceCount ||
        'resourceCount is the raw PerformanceResourceTiming resource entry count used by the hard budget gate.',
      report.metricDefinitions?.scriptCount ||
        'scriptCount is the raw PerformanceResourceTiming JavaScript resource entry count used by the hard budget gate.',
      report.metricDefinitions?.jsDecodedBytes ||
        'jsDecodedBytes is the sum of decodedBodySize for raw JavaScript resource entries.',
      report.metricDefinitions?.uniqueScriptCount ||
        'uniqueScriptCount is the count of distinct normalized JavaScript resource URLs after de-duplication.',
      'Warnings are still budget regressions. Do not silence failures by changing thresholds or workflow env values.',
      'If failedHealthChecks is non-empty, fix page rendering/readiness first because budget samples may be invalid.',
    ],
    reportPath: report.reportPath || null,
    buildDir,
    command: "PERF_WEB_COLD_SCENARIOS='<failed scenarios>' yarn perf:web:cold",
    metricDefinitions: report.metricDefinitions || null,
    aiFixPrompt: [
      'Download artifact web-startup-cold-budget-reports and read web-cold-budget-report-ai-hints.json plus web-cold-budget-report.json before editing; Markdown is only a summary.',
      'Fix the OneKey web cold/startup budget without relaxing thresholds.',
      'Use scenarios[] as the source of truth; top-level summary/budgetChecks/runs are legacy-compatible first-scenario fields.',
      'Start from failedOrWarnBudgetChecks, then inspect duplicateScripts, scenarioOnlyScriptCandidates, and smallScriptCandidates.',
      'scriptCount/resourceCount/jsDecodedBytes are raw hard-gate metrics; use uniqueResourceCount, uniqueScriptCount, uniqueJsDecodedBytes, and duplicateScripts to inspect repeated preload/script/cache entries.',
      'Do not assume only the home page can fail: any change entering the global shell, shared modules, first-screen synchronous imports, or lazy loads auto-mounted within the cold-start window can affect this budget.',
      'For scriptCount/resourceCount failures, prefer merging related lazy import() boundaries or delaying non-first-screen providers.',
      'Do not edit development/perf-ci/thresholds or workflow budget env values to silence a regression.',
      'Preserve mount delays, side effects, routing behavior, and visible UI behavior.',
      'Validate with the focused PERF_WEB_COLD_SCENARIOS command plus yarn tsc:staged and yarn lint:staged.',
    ],
    importChains: report.startupGraphBudget?.importChains,
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
    artifactName: WEB_BUDGET_ARTIFACT,
    artifactInstructions: [
      `Download GitHub Actions artifact "${WEB_BUDGET_ARTIFACT}".`,
      'Read web-startup-graph-budget-report-ai-hints.json first; Markdown is only a summary.',
      'Cross-check web-startup-graph-budget-report.json and web-cold-budget-report.json before editing startup imports.',
    ],
    reportNotes: [
      'Fix startup graph and cold-entry budgets together. Moving code behind many one-file lazy chunks can pass startup graph while failing web cold script/resource budgets.',
      'Do not silence failures by changing thresholds or workflow budget env values.',
    ],
    buildDir,
    failedBudgetChecks: failedBudgetChecks(report.budgetChecks),
    failures: report.failures,
    summary: report.summary,
    budgets: report.budgets,
    aiFixPrompt: [
      'Download artifact web-startup-cold-budget-reports and read web-startup-graph-budget-report-ai-hints.json plus the raw report JSON before editing; Markdown is only a summary.',
      'Fix the OneKey web startup graph budget without relaxing thresholds.',
      'Inspect failedBudgetChecks, then topModules, topPackages, and initialScriptHints.',
      'Do not assume only the home page can fail: any change entering the global shell, shared modules, first-screen synchronous imports, or lazy loads auto-mounted within the cold-start window can affect this budget.',
      'If initialScriptCount or startup module count grows, move non-first-screen imports behind lazy import() boundaries.',
      'If allScriptRawBytes grows, inspect newly created chunks and avoid one-file lazy chunks when related modules can share one lazy entry.',
      'Do not edit development/perf-ci/thresholds or workflow budget env values to silence a regression.',
      'Validate with yarn perf:web:cold or apps/web/scripts/check-startup-graph-budget.js against the production build.',
    ],
    topModules: report.topModules,
    topPackages: report.topPackages,
    importChains: report.importChains,
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
    artifactName: NATIVE_BUDGET_ARTIFACT,
    entry: report.entry,
    runtimeScope:
      report.entry === 'background'
        ? 'background JS runtime'
        : 'main UI JS runtime',
    artifactInstructions: [
      `Download GitHub Actions artifact "${NATIVE_BUDGET_ARTIFACT}".`,
      `Read out-dir-analysis/budget-check-ai-hints-${report.entry}.json and out-dir-analysis/budget-check-report-${report.entry}.json first; Markdown is only a summary.`,
      `Cross-check dist/allocation-report-${report.entry}.json for raw startup modules and segments.`,
    ],
    reportNotes: [
      'Use per-entry report/hints files. The generic budget-check-report.json is intentionally not emitted in dual-entry CI.',
      'Do not silence failures by changing STARTUP_* budgets or workflow env values.',
    ],
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
      `Download artifact bundle-architecture-reports and read budget-check-ai-hints-${report.entry}.json plus budget-check-report-${report.entry}.json before editing; Markdown is only a summary.`,
      'Fix the OneKey native startup graph budget without relaxing thresholds.',
      'Label runtime impact explicitly: main UI JS runtime, background JS runtime, or both.',
      'Do not reason from the changed screen name alone: startup graph regressions come from dependency chains that enter global shell code, shared modules, entrypoint synchronous imports, or auto-mounted startup/lazy providers.',
      'Use startupPackageCounts, startupPrefixCounts, and forbiddenModulesFound to find the dependency chain that entered startup.',
      'Move non-startup work behind lazy segments or runtime-specific imports while preserving main/background isolation.',
      'Do not edit STARTUP_* budgets or workflow env values to silence a regression.',
      'Validate the affected ENTRY with ENABLE_NATIVE_BACKGROUND_THREAD=true and the same STARTUP_* budget env vars from CI.',
    ],
    forbiddenModulesFound: report.forbiddenModulesFound,
    importChains: allocationReport?.importChains,
    startupPackageCounts: countBy(startupModules, getPackageName).slice(0, 30),
    startupPrefixCounts: countBy(startupModules, modulePrefix).slice(0, 50),
    startupModulesSample: startupModules.slice(0, 200),
    commonStartupPrefixCounts: countBy(
      commonStartupModules,
      modulePrefix,
    ).slice(0, 30),
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

function markdownHealthRows(checks) {
  if (!checks?.length) return '';
  return checks
    .map(
      (check) =>
        `- ${check.name}: actual ${check.actual}, expected ${check.expected}`,
    )
    .join('\n');
}

function countRowsText(rows, limit) {
  return limitRows(rows || [], limit)
    .map((item) => `${item.count} ${item.name}`)
    .join(', ');
}

function markdownImportChains(importChains, limit = 12) {
  const chains = importChains?.chains || [];
  if (!chains.length) return '';
  const lines = [
    `- graph nodes: ${importChains.graphNodeCount ?? 'n/a'}, edges: ${importChains.graphEdgeCount ?? 'n/a'}, roots: ${(importChains.roots || []).join(', ') || 'n/a'}`,
  ];
  for (const chain of limitRows(chains, limit)) {
    lines.push(
      `- ${chain.status} ${chain.target} (${chain.chain?.length || 0} edges)`,
    );
    for (const edge of limitRows(chain.chain || [], 8)) {
      lines.push(
        `  - ${edge.from} -> ${edge.to} (${edge.edgeType || 'unknown'}, ${edge.specifier || 'unknown'})`,
      );
    }
  }
  return lines.join('\n');
}

function printAiTriageInstructions({
  artifactName,
  aiHintsJsonPath,
  aiHintsMarkdownPath,
  reportPath,
  extraPaths = [],
  notes = [],
  log,
}) {
  if (typeof log !== 'function') return;
  const lines = [
    '',
    'AI triage instructions:',
    `  1. Download GitHub Actions artifact: ${artifactName}`,
    `  2. Read AI hints JSON first: ${aiHintsJsonPath}`,
    `  3. Use Markdown only as a summary: ${aiHintsMarkdownPath}`,
    `  4. Cross-check raw report JSON: ${reportPath}`,
  ];
  for (const item of extraPaths) {
    lines.push(`  - Related report: ${item}`);
  }
  for (const note of notes) {
    lines.push(`  - Note: ${note}`);
  }
  for (const line of lines) log(line);
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
  if (hints.artifactName || hints.artifactInstructions?.length) {
    lines.push('', '## Required Artifacts');
    if (hints.artifactName) {
      lines.push(`- GitHub Actions artifact: ${hints.artifactName}`);
    }
    for (const item of hints.artifactInstructions || []) {
      lines.push(`- ${item}`);
    }
  }
  if (hints.reportNotes?.length) {
    lines.push('', '## Report Notes');
    for (const item of hints.reportNotes) lines.push(`- ${item}`);
  }
  lines.push('', '## AI Fix Prompt');
  for (const item of hints.aiFixPrompt || []) lines.push(`- ${item}`);
  lines.push('', '## Failed or Warning Budgets');
  lines.push(markdownBudgetRows(hints.failedBudgetChecks));
  if (hints.scenarios?.length) {
    const failedScenarios = hints.scenarios.filter(
      (scenario) =>
        scenario.failedOrWarnBudgetChecks?.length ||
        scenario.failedHealthChecks?.length,
    );
    if (failedScenarios.length) {
      lines.push('', '## Failed or Warning Scenarios');
      for (const scenario of failedScenarios) {
        const failureNames = (scenario.failedOrWarnBudgetChecks || [])
          .map((check) => `${check.status || 'fail'} ${check.name}`)
          .join(', ');
        const healthNames = (scenario.failedHealthChecks || [])
          .map((check) => `health ${check.name}`)
          .join(', ');
        lines.push(
          `- ${scenario.name}: ${[failureNames, healthNames]
            .filter(Boolean)
            .join('; ')}`,
        );
      }
    }
    lines.push('', '## Scenarios');
    for (const scenario of hints.scenarios) {
      lines.push('', `### ${scenario.name}`);
      lines.push(markdownBudgetRows(scenario.failedOrWarnBudgetChecks));
      if (scenario.failedHealthChecks?.length) {
        lines.push('- failed health checks:');
        lines.push(markdownHealthRows(scenario.failedHealthChecks));
      }
      const scriptMetrics = [
        `budget scripts(raw): ${scenario.scriptCount ?? 'n/a'}`,
        `unique scripts: ${scenario.uniqueScriptCount ?? 'n/a'}`,
        `unique JS decoded: ${formatBytes(scenario.uniqueJsDecodedBytes)}`,
        `raw resource entries: ${scenario.rawResourceCount ?? 'n/a'}`,
      ];
      lines.push(`- ${scriptMetrics.join(', ')}`);
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
      if (scenario.topScriptsByDecodedSize?.length) {
        lines.push('- top scripts by decoded size:');
        for (const item of limitRows(scenario.topScriptsByDecodedSize, 8)) {
          lines.push(
            `  - ${formatBytes(item.decodedBodySize || item.bytes)} ${item.pathname} (${item.sourceCount} sources)`,
          );
        }
      }
    }
  }
  if (hints.topModules?.length) {
    lines.push('', '## Top Modules');
    for (const item of limitRows(hints.topModules, 20)) {
      const packageName = item.packageName ? `, ${item.packageName}` : '';
      lines.push(
        `- ${formatBytes(item.bytes)} ${item.source} (${item.category || 'unknown'}${packageName})`,
      );
    }
  }
  if (hints.topPackages?.length) {
    lines.push('', '## Top Packages');
    for (const item of limitRows(hints.topPackages, 20)) {
      lines.push(`- ${formatBytes(item.bytes)} ${item.name}`);
    }
  }
  if (hints.initialScriptHints?.length) {
    lines.push('', '## Initial Script Hints');
    for (const item of limitRows(hints.initialScriptHints, 8)) {
      lines.push(
        `- ${formatBytes(item.bytes)} ${item.file} (${item.moduleCount} modules)`,
      );
      const packageCounts = countRowsText(item.packageCounts, 6);
      if (packageCounts) lines.push(`  - packages: ${packageCounts}`);
      if (item.topModules?.length) {
        lines.push('  - top modules:');
        for (const moduleRow of limitRows(item.topModules, 5)) {
          lines.push(
            `    - ${formatBytes(moduleRow.bytes)} ${moduleRow.source}`,
          );
        }
      }
    }
  }
  if (hints.importChains?.chains?.length) {
    lines.push('', '## Import Chains');
    lines.push(markdownImportChains(hints.importChains));
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
  if (hints.commonStartupPrefixCounts?.length) {
    lines.push('', '## Common Startup Prefix Counts');
    for (const item of limitRows(hints.commonStartupPrefixCounts, 20)) {
      lines.push(`- ${item.count} ${item.name}`);
    }
  }
  if (hints.topSegmentsBySize?.length) {
    lines.push('', '## Top Segments By Size');
    for (const item of limitRows(hints.topSegmentsBySize, 20)) {
      const runtime = item.runtime || item.runtimes?.join(',') || 'unknown';
      lines.push(
        `- ${formatBytes(item.size)} ${item.name} (${item.moduleCount} modules, ${runtime})`,
      );
    }
  }
  if (hints.topSegmentsByModuleCount?.length) {
    lines.push('', '## Top Segments By Module Count');
    for (const item of limitRows(hints.topSegmentsByModuleCount, 20)) {
      const runtime = item.runtime || item.runtimes?.join(',') || 'unknown';
      lines.push(
        `- ${item.moduleCount} modules ${item.name} (${formatBytes(item.size)}, ${runtime})`,
      );
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
  NATIVE_BUDGET_ARTIFACT,
  WEB_BUDGET_ARTIFACT,
  createNativeStartupAiHints,
  createWebColdAiHints,
  createWebStartupAiHints,
  defaultSiblingPath,
  formatBytes,
  printAiTriageInstructions,
  writeAiHints,
};
