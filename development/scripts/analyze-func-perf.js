#!/usr/bin/env node

/**
 * Parse functions.log JSONL and print hottest functions/modules.
 *
 * Usage:
 *   node development/scripts/analyze-func-perf.js
 *
 * All parameters are optional with sensible defaults:
 *   - Input:  development/output/profiler/functions.log
 *   - Output: development/output/profiler/report.json
 *   - Output: development/output/profiler/speedscope.json
 *   - Output: development/output/profiler/report.md
 *
 * Custom paths (all optional):
 *   node development/scripts/analyze-func-perf.js [input.log] [report.json] [speedscope.json] [report.md]
 */

const fs = require('fs');
const path = require('path');

const defaultOutputDir = path.join(__dirname, '../output/profiler');

const inputPath =
  process.argv[2] ||
  path.join(defaultOutputDir, 'functions.log');
const outputPath = process.argv[3] ?? path.join(defaultOutputDir, 'report.json');
const speedscopePath = process.argv[4] ?? path.join(defaultOutputDir, 'speedscope.json');
const markdownPath = process.argv[5] ?? path.join(defaultOutputDir, 'report.md');

const SKIP_PATTERNS = [
  /healthcheck/i,
  /healthCheckRequest/i,
];

if (!fs.existsSync(inputPath)) {
  console.error(`Log not found: ${inputPath}`);
  process.exit(1);
}

function safeParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function pickModule(file) {
  if (!file) return 'unknown';
  if (file.includes('packages/kit/src/views/')) return 'kit/views';
  if (file.includes('packages/kit/src/hooks/')) return 'kit/hooks';
  if (file.includes('packages/kit-bg/src/services/')) return 'kit-bg/services';
  if (file.includes('packages/shared/src/request/')) return 'shared/request';
  const parts = file.split('/');
  const idx = parts.indexOf('packages');
  if (idx >= 0 && parts[idx + 1]) {
    return parts.slice(idx + 1, idx + 3).join('/');
  }
  return 'other';
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

function simplifyStackFrame(frame) {
  if (!frame) return 'unknown';
  // Extract just the function name from "file:line#name"
  const match = frame.match(/#([^#]+)$/);
  return match ? match[1] : frame;
}

const lines = fs
  .readFileSync(inputPath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(safeParse)
  .filter(Boolean)
  .filter((e) => typeof e.duration === 'number')
  .filter((e) => !SKIP_PATTERNS.some((re) => re.test(e.file || '') || re.test(e.name || '')));

if (!lines.length) {
  console.log('No entries with duration found.');
  process.exit(0);
}

const fnMap = new Map();
const moduleMap = new Map();
const pageMap = new Map();
const routeMap = new Map();
const callChainMap = new Map();
const repeatCallMap = new Map();

// Track repeated calls within short time windows
let prevEntry = null;
const REPEAT_WINDOW_MS = 100;

for (const entry of lines) {
  const key = `${entry.file}:${entry.line || 0}#${entry.name}`;
  const module = entry.module || pickModule(entry.file);
  const page = entry.page || entry.component || 'unknown';
  const route = entry.route || 'unknown';

  // Function stats
  const existing =
    fnMap.get(key) || { name: entry.name, file: entry.file, line: entry.line, module, page, count: 0, total: 0, max: 0, durations: [] };
  existing.count += 1;
  existing.total += entry.duration;
  existing.max = Math.max(existing.max, entry.duration);
  if (existing.durations.length < 200) {
    existing.durations.push(entry.duration);
  }
  fnMap.set(key, existing);

  // Module stats
  const mod = moduleMap.get(module) || { module, count: 0, total: 0, max: 0 };
  mod.count += 1;
  mod.total += entry.duration;
  mod.max = Math.max(mod.max, entry.duration);
  moduleMap.set(module, mod);

  // Page stats
  const pageKey = `${module}:${page}`;
  const pageEntry =
    pageMap.get(pageKey) || { module, page, count: 0, total: 0, max: 0 };
  pageEntry.count += 1;
  pageEntry.total += entry.duration;
  pageEntry.max = Math.max(pageEntry.max, entry.duration);
  pageMap.set(pageKey, pageEntry);

  // Route stats (runtime context)
  const routeEntry = routeMap.get(route) || { route, count: 0, total: 0, max: 0, functions: new Set() };
  routeEntry.count += 1;
  routeEntry.total += entry.duration;
  routeEntry.max = Math.max(routeEntry.max, entry.duration);
  routeEntry.functions.add(entry.name);
  routeMap.set(route, routeEntry);

  // Call chain analysis
  if (Array.isArray(entry.stack) && entry.stack.length > 0) {
    const chainKey = entry.stack.map(simplifyStackFrame).join(' → ') + ' → ' + entry.name;
    const chainEntry = callChainMap.get(chainKey) || { chain: chainKey, count: 0, total: 0, max: 0 };
    chainEntry.count += 1;
    chainEntry.total += entry.duration;
    chainEntry.max = Math.max(chainEntry.max, entry.duration);
    callChainMap.set(chainKey, chainEntry);
  }

  // Repeated calls detection
  if (prevEntry && prevEntry.name === entry.name && (entry.ts - prevEntry.ts) < REPEAT_WINDOW_MS) {
    const repeatKey = `${entry.name}@${entry.file}`;
    const repeatEntry = repeatCallMap.get(repeatKey) || { name: entry.name, file: entry.file, count: 0, totalDuration: 0 };
    repeatEntry.count += 1;
    repeatEntry.totalDuration += entry.duration;
    repeatCallMap.set(repeatKey, repeatEntry);
  }
  prevEntry = entry;
}

const hotFns = Array.from(fnMap.values())
  .map((f) => ({
    ...f,
    avg: f.total / f.count,
    p95: percentile(f.durations, 95),
  }))
  .sort((a, b) => b.p95 - a.p95 || b.max - a.max)
  .slice(0, 30);

const hotModules = Array.from(moduleMap.values())
  .map((m) => ({
    ...m,
    avg: m.total / m.count,
  }))
  .sort((a, b) => b.total - a.total);

const hotPages = Array.from(pageMap.values())
  .map((p) => ({
    ...p,
    avg: p.total / p.count,
  }))
  .sort((a, b) => b.max - a.max);

const hotRoutes = Array.from(routeMap.values())
  .map((r) => ({
    ...r,
    avg: r.total / r.count,
    functionCount: r.functions.size,
  }))
  .sort((a, b) => b.total - a.total);

const hotCallChains = Array.from(callChainMap.values())
  .map((c) => ({
    ...c,
    avg: c.total / c.count,
  }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 20);

const repeatedCalls = Array.from(repeatCallMap.values())
  .filter((r) => r.count >= 3)
  .sort((a, b) => b.count - a.count)
  .slice(0, 20);

console.log(`Analyzed ${lines.length} calls from ${inputPath}\n`);
console.log('=== Top Functions (by p95) ===');
hotFns.forEach((f, idx) => {
  console.log(
    `${idx + 1}. ${f.name} (${f.module}) ${f.file}:${f.line || 0} - max=${f.max.toFixed(
      2,
    )}ms p95=${f.p95.toFixed(2)}ms avg=${f.avg.toFixed(2)}ms count=${
      f.count
    }`,
  );
});

console.log('\n=== Modules (by total time) ===');
hotModules.forEach((m) => {
  console.log(
    `- ${m.module}: total=${m.total.toFixed(0)}ms max=${m.max.toFixed(2)}ms avg=${m.avg.toFixed(
      2,
    )}ms samples=${m.count}`,
  );
});

console.log('\n=== Pages ===');
hotPages.slice(0, 15).forEach((p) => {
  console.log(
    `- ${p.module}:${p.page} max=${p.max.toFixed(2)}ms avg=${p.avg.toFixed(
      2,
    )}ms samples=${p.count}`,
  );
});

if (hotRoutes.some((r) => r.route !== 'unknown')) {
  console.log('\n=== Routes (runtime context) ===');
  hotRoutes.filter((r) => r.route !== 'unknown').slice(0, 10).forEach((r) => {
    console.log(
      `- ${r.route}: total=${r.total.toFixed(0)}ms max=${r.max.toFixed(2)}ms functions=${r.functionCount} calls=${r.count}`,
    );
  });
}

if (hotCallChains.length > 0) {
  console.log('\n=== Hot Call Chains ===');
  hotCallChains.slice(0, 10).forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.total.toFixed(0)}ms total, ${c.count}x] ${c.chain}`);
  });
}

if (repeatedCalls.length > 0) {
  console.log('\n=== Repeated Calls (potential optimization) ===');
  repeatedCalls.forEach((r) => {
    console.log(`- ${r.name} called ${r.count}x rapidly (${r.totalDuration.toFixed(0)}ms total)`);
  });
}

if (outputPath) {
  // Clean up Set objects for JSON serialization
  const routesForJson = hotRoutes.map((r) => ({
    route: r.route,
    count: r.count,
    total: r.total,
    max: r.max,
    avg: r.avg,
    functionCount: r.functionCount,
  }));
  const out = {
    summary: {
      totalCalls: lines.length,
      functions: hotFns.length,
      modules: hotModules.length,
      pages: hotPages.length,
      routes: hotRoutes.filter((r) => r.route !== 'unknown').length,
    },
    functions: hotFns,
    modules: hotModules,
    pages: hotPages,
    routes: routesForJson.filter((r) => r.route !== 'unknown'),
    callChains: hotCallChains,
    repeatedCalls,
  };
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\nSaved analysis to ${outputPath}`);
}

if (speedscopePath) {
  // Minimal speedscope sample profile
  const frames = [];
  const frameIndex = new Map();
  function internFrame(name) {
    if (!name || name === 'null') return null;
    if (frameIndex.has(name)) return frameIndex.get(name);
    const idx = frames.length;
    frames.push({ name });
    frameIndex.set(name, idx);
    return idx;
  }
  const samples = [];
  const weights = [];
  for (const entry of lines) {
    const stackFrames = Array.isArray(entry.stack)
      ? entry.stack
          .filter((s) => s != null && s !== 'null' && s !== '')
          .map((s) => simplifyStackFrame(String(s)))
      : [];
    const allFrames = [entry.name, ...stackFrames];
    const framesArr = allFrames
      .map(internFrame)
      .filter((idx) => idx !== null);
    if (!framesArr.length) continue;
    samples.push(framesArr);
    weights.push(entry.duration);
  }
  const profile = {
    type: 'sampled',
    name: 'RN Function Perf',
    unit: 'milliseconds',
    startValue: 0,
    endValue: weights.reduce((a, b) => a + b, 0),
    samples,
    weights,
  };
  const speedscope = {
    $schema: 'https://www.speedscope.app/file-format-schema.json',
    version: '0.0.1',
    shared: { frames },
    profiles: [profile],
    activeProfileIndex: 0,
  };
  fs.writeFileSync(speedscopePath, JSON.stringify(speedscope, null, 2), 'utf8');
  console.log(`Saved speedscope JSON to ${speedscopePath}`);
}

if (markdownPath) {
  const warnThreshold = 120;
  const offenders = hotFns.filter(
    (f) => f.max >= warnThreshold || f.p95 >= warnThreshold,
  );
  let md = `# Function Performance Report\n\nAnalyzed ${lines.length} calls from ${inputPath}\n\n## Top Offenders (>=${warnThreshold}ms)\n`;
  if (!offenders.length) {
    md += 'No functions exceed threshold.\n';
  } else {
    md += 'Name | Module | File:Line | Max (ms) | P95 (ms) | Avg (ms) | Count\n';
    md += '---|---|---|---|---|---|---\n';
    offenders.forEach((f) => {
      md += `${f.name}|${f.module}|${f.file}:${f.line || 0}|${f.max.toFixed(
        2,
      )}|${f.p95.toFixed(2)}|${f.avg.toFixed(2)}|${f.count}\n`;
    });
  }
  md += '\n## Modules\n';
  hotModules.forEach((m) => {
    md += `- ${m.module}: max=${m.max.toFixed(2)}ms avg=${m.avg.toFixed(
      2,
    )}ms samples=${m.count}\n`;
  });
  md += '\n## Pages\n';
  hotPages.slice(0, 30).forEach((p) => {
    md += `- ${p.module}:${p.page} max=${p.max.toFixed(2)}ms avg=${p.avg.toFixed(
      2,
    )}ms samples=${p.count}\n`;
  });

  // Routes section
  const knownRoutes = hotRoutes.filter((r) => r.route !== 'unknown');
  if (knownRoutes.length > 0) {
    md += '\n## Routes (Runtime Context)\n';
    md += 'Route | Total (ms) | Max (ms) | Functions | Calls\n';
    md += '---|---|---|---|---\n';
    knownRoutes.slice(0, 15).forEach((r) => {
      md += `${r.route}|${r.total.toFixed(0)}|${r.max.toFixed(2)}|${r.functionCount}|${r.count}\n`;
    });
  }

  // Call chains section
  if (hotCallChains.length > 0) {
    md += '\n## Hot Call Chains\n';
    md += 'These call paths consume the most time:\n\n';
    hotCallChains.slice(0, 10).forEach((c, idx) => {
      md += `${idx + 1}. **${c.total.toFixed(0)}ms** (${c.count}x): \`${c.chain}\`\n`;
    });
  }

  // Repeated calls section
  if (repeatedCalls.length > 0) {
    md += '\n## Repeated Calls (Potential Optimization)\n';
    md += 'Functions called rapidly in succession (possible redundant calls):\n\n';
    md += 'Function | Rapid Calls | Total Time (ms) | File\n';
    md += '---|---|---|---\n';
    repeatedCalls.forEach((r) => {
      md += `${r.name}|${r.count}|${r.totalDuration.toFixed(0)}|${r.file}\n`;
    });
  }

  fs.writeFileSync(markdownPath, md, 'utf8');
  console.log(`Saved markdown report to ${markdownPath}`);
}
