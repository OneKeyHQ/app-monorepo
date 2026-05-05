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

const SKIP_PATTERNS = [/healthcheck/i, /healthCheckRequest/i];

function ensureFileDir(filePath) {
  const dir = path.dirname(filePath);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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

  const normalized = normalizePath(file);
  const parts = normalized.split('/').filter(Boolean);
  const packagesIdx = parts.indexOf('packages');
  if (packagesIdx < 0 || !parts[packagesIdx + 1]) return 'other';

  const pkg = parts[packagesIdx + 1];
  const srcIdx = parts.indexOf('src', packagesIdx + 2);
  if (srcIdx >= 0 && parts[srcIdx + 1]) {
    const scope = parts[srcIdx + 1];
    if (scope.includes('.')) {
      return pkg;
    }
    return `${pkg}/${scope}`;
  }

  return pkg;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].toSorted((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

function simplifyStackFrame(frame) {
  if (!frame) return 'unknown';
  // Extract function name from "file:line#name"
  const match = frame.match(/#([^#]+)$/);
  return match ? match[1] : frame;
}

function normalizePath(p) {
  return typeof p === 'string' ? p.replace(/\\/g, '/') : p;
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw.data && typeof raw.data === 'object' ? raw.data : raw;
  const duration =
    typeof payload.duration === 'number' ? payload.duration : raw.duration;
  if (typeof duration !== 'number') return null;

  const name = payload.name || raw.name;
  if (!name) return null;

  const tsCandidate =
    payload.timestamp ??
    raw.timestamp ??
    payload.ts ??
    raw.ts ??
    payload.time ??
    raw.time ??
    payload.absoluteTime ??
    raw.absoluteTime;
  const ts = Number.isFinite(Number(tsCandidate)) ? Number(tsCandidate) : 0;

  const file = normalizePath(payload.file || raw.file || '');
  const stack = Array.isArray(payload.stack || raw.stack)
    ? (payload.stack || raw.stack).map((s) => normalizePath(String(s)))
    : [];

  const module = payload.module || raw.module || pickModule(file);

  return {
    name,
    duration,
    file,
    line: payload.line || raw.line || 0,
    module,
    page:
      payload.page ||
      raw.page ||
      payload.component ||
      raw.component ||
      'unknown',
    route: payload.route || raw.route || 'unknown',
    stack,
    ts,
    absoluteTime: payload.absoluteTime || raw.absoluteTime || null,
    raw,
  };
}

function readEntriesFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Log not found: ${filePath}`);
  }
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(safeParse)
    .filter(Boolean)
    .map(normalizeEntry)
    .filter(Boolean)
    .filter(
      (e) =>
        !SKIP_PATTERNS.some(
          (re) => re.test(e.file || '') || re.test(e.name || ''),
        ),
    );
}

function analyzeEntries(entries) {
  if (!entries.length) {
    return {
      summary: { totalCalls: 0, functions: 0, modules: 0, pages: 0, routes: 0 },
      functions: [],
      modules: [],
      pages: [],
      routes: [],
      callChains: [],
      repeatedCalls: [],
    };
  }

  const fnMap = new Map();
  const moduleMap = new Map();
  const pageMap = new Map();
  const routeMap = new Map();
  const callChainMap = new Map();
  const repeatCallMap = new Map();

  let prevEntry = null;
  const REPEAT_WINDOW_MS = 100;

  for (const entry of entries) {
    const key = `${entry.file}:${entry.line || 0}#${entry.name}`;
    const module = entry.module || pickModule(entry.file);
    const page = entry.page || 'unknown';
    const route = entry.route || 'unknown';

    const existing = fnMap.get(key) || {
      name: entry.name,
      file: entry.file,
      line: entry.line,
      module,
      page,
      count: 0,
      total: 0,
      max: 0,
      durations: [],
    };
    existing.count += 1;
    existing.total += entry.duration;
    existing.max = Math.max(existing.max, entry.duration);
    if (existing.durations.length < 200) {
      existing.durations.push(entry.duration);
    }
    fnMap.set(key, existing);

    const mod = moduleMap.get(module) || { module, count: 0, total: 0, max: 0 };
    mod.count += 1;
    mod.total += entry.duration;
    mod.max = Math.max(mod.max, entry.duration);
    moduleMap.set(module, mod);

    const pageKey = `${module}:${page}`;
    const pageEntry = pageMap.get(pageKey) || {
      module,
      page,
      count: 0,
      total: 0,
      max: 0,
    };
    pageEntry.count += 1;
    pageEntry.total += entry.duration;
    pageEntry.max = Math.max(pageEntry.max, entry.duration);
    pageMap.set(pageKey, pageEntry);

    const routeEntry = routeMap.get(route) || {
      route,
      count: 0,
      total: 0,
      max: 0,
      functions: new Set(),
    };
    routeEntry.count += 1;
    routeEntry.total += entry.duration;
    routeEntry.max = Math.max(routeEntry.max, entry.duration);
    routeEntry.functions.add(entry.name);
    routeMap.set(route, routeEntry);

    if (Array.isArray(entry.stack) && entry.stack.length > 0) {
      const chainKey = `${entry.stack.map(simplifyStackFrame).join(' → ')} → ${
        entry.name
      }`;
      const chainEntry = callChainMap.get(chainKey) || {
        chain: chainKey,
        count: 0,
        total: 0,
        max: 0,
      };
      chainEntry.count += 1;
      chainEntry.total += entry.duration;
      chainEntry.max = Math.max(chainEntry.max, entry.duration);
      callChainMap.set(chainKey, chainEntry);
    }

    if (
      prevEntry &&
      prevEntry.name === entry.name &&
      Math.abs(entry.ts - prevEntry.ts) < REPEAT_WINDOW_MS
    ) {
      const repeatKey = `${entry.name}@${entry.file}`;
      const repeatEntry = repeatCallMap.get(repeatKey) || {
        name: entry.name,
        file: entry.file,
        count: 0,
        totalDuration: 0,
      };
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
    .toSorted((a, b) => b.p95 - a.p95 || b.max - a.max)
    .slice(0, 30);

  const hotModules = Array.from(moduleMap.values())
    .map((m) => ({
      ...m,
      avg: m.total / m.count,
    }))
    .toSorted((a, b) => b.total - a.total);

  const hotPages = Array.from(pageMap.values())
    .map((p) => ({
      ...p,
      avg: p.total / p.count,
    }))
    .toSorted((a, b) => b.max - a.max);

  const hotRoutes = Array.from(routeMap.values())
    .map((r) => ({
      ...r,
      avg: r.total / r.count,
      functionCount: r.functions.size,
    }))
    .toSorted((a, b) => b.total - a.total);

  const hotCallChains = Array.from(callChainMap.values())
    .map((c) => ({
      ...c,
      avg: c.total / c.count,
    }))
    .toSorted((a, b) => b.total - a.total)
    .slice(0, 20);

  const repeatedCalls = Array.from(repeatCallMap.values())
    .filter((r) => r.count >= 3)
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    summary: {
      totalCalls: entries.length,
      functions: hotFns.length,
      modules: hotModules.length,
      pages: hotPages.length,
      routes: hotRoutes.filter((r) => r.route !== 'unknown').length,
    },
    functions: hotFns,
    modules: hotModules,
    pages: hotPages,
    routes: hotRoutes.filter((r) => r.route !== 'unknown'),
    callChains: hotCallChains,
    repeatedCalls,
  };
}

function buildSpeedscope(entries, profileName = 'RN Function Perf') {
  // Use a sampled profile and scale weights to the real wall time span to avoid
  // invalid crossing stacks while keeping proportions correct.
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

  const usable = entries
    .map((e) => ({
      ...e,
      ts: Number.isFinite(e.ts) ? e.ts : 0,
      duration: Number.isFinite(e.duration) ? e.duration : 0,
    }))
    .filter((e) => e.duration > 0);

  const minTs = usable.reduce(
    (m, e) => Math.min(m, e.ts - e.duration),
    Infinity,
  );
  const maxEnd = usable.reduce((m, e) => Math.max(m, e.ts), 0);
  const span = Math.max(maxEnd - (Number.isFinite(minTs) ? minTs : 0), 1);

  const samples = [];
  const weights = [];
  let totalDuration = 0;

  for (const entry of usable) {
    const stackFrames = Array.isArray(entry.stack)
      ? entry.stack
          .filter(
            (s) => s !== null && s !== undefined && s !== 'null' && s !== '',
          )
          .map((s) => simplifyStackFrame(String(s)))
      : [];
    const allFrames = [...stackFrames, entry.name];
    const framesArr = allFrames.map(internFrame).filter((idx) => idx !== null);
    if (framesArr.length) {
      samples.push(framesArr);
      weights.push(entry.duration);
      totalDuration += entry.duration;
    }
  }

  const scale = totalDuration > 0 ? span / totalDuration : 1;
  const scaledWeights = weights.map((w) => w * scale);
  const endValue = scaledWeights.reduce((a, b) => a + b, 0);

  return {
    $schema: 'https://www.speedscope.app/file-format-schema.json',
    version: '0.0.1',
    shared: { frames },
    profiles: [
      {
        type: 'sampled',
        name: profileName,
        unit: 'milliseconds',
        startValue: 0,
        endValue,
        samples,
        weights: scaledWeights,
      },
    ],
    activeProfileIndex: 0,
  };
}

function writeAnalysisOutputs({
  entries,
  reportPath,
  speedscopePath,
  markdownPath,
}) {
  const analysis = analyzeEntries(entries);
  if (reportPath) {
    ensureFileDir(reportPath);
    fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2), 'utf8');
    console.log(`\nSaved analysis to ${reportPath}`);
  }
  if (speedscopePath) {
    ensureFileDir(speedscopePath);
    const speedscope = buildSpeedscope(entries);
    fs.writeFileSync(
      speedscopePath,
      JSON.stringify(speedscope, null, 2),
      'utf8',
    );
    console.log(`Saved speedscope JSON to ${speedscopePath}`);
  }
  if (markdownPath) {
    ensureFileDir(markdownPath);
    const warnThreshold = 120;
    const offenders = (analysis.functions || []).filter(
      (f) => f.max >= warnThreshold || f.p95 >= warnThreshold,
    );
    let md = `# Function Performance Report\n\nAnalyzed ${analysis.summary.totalCalls} calls\n\n## Top Offenders (>=${warnThreshold}ms)\n`;
    if (!offenders.length) {
      md += 'No functions exceed threshold.\n';
    } else {
      md +=
        'Name | Module | File:Line | Max (ms) | P95 (ms) | Avg (ms) | Count\n';
      md += '---|---|---|---|---|---|---\n';
      offenders.forEach((f) => {
        md += `${f.name}|${f.module}|${f.file}:${f.line || 0}|${f.max.toFixed(
          2,
        )}|${f.p95.toFixed(2)}|${f.avg.toFixed(2)}|${f.count}\n`;
      });
    }
    md += '\n## Modules\n';
    (analysis.modules || []).forEach((m) => {
      md += `- ${m.module}: max=${m.max.toFixed(2)}ms avg=${m.avg.toFixed(
        2,
      )}ms samples=${m.count}\n`;
    });
    md += '\n## Pages\n';
    (analysis.pages || []).slice(0, 30).forEach((p) => {
      md += `- ${p.module}:${p.page} max=${p.max.toFixed(
        2,
      )}ms avg=${p.avg.toFixed(2)}ms samples=${p.count}\n`;
    });

    const knownRoutes = (analysis.routes || []).filter(
      (r) => r.route !== 'unknown',
    );
    if (knownRoutes.length > 0) {
      md += '\n## Routes (Runtime Context)\n';
      md += 'Route | Total (ms) | Max (ms) | Functions | Calls\n';
      md += '---|---|---|---|---\n';
      knownRoutes.slice(0, 15).forEach((r) => {
        md += `${r.route}|${r.total.toFixed(0)}|${r.max.toFixed(2)}|${
          r.functionCount
        }|${r.count}\n`;
      });
    }

    if ((analysis.callChains || []).length > 0) {
      md += '\n## Hot Call Chains\n';
      md += 'These call paths consume the most time:\n\n';
      (analysis.callChains || []).slice(0, 10).forEach((c, idx) => {
        md += `${idx + 1}. **${c.total.toFixed(0)}ms** (${c.count}x): \`${
          c.chain
        }\`\n`;
      });
    }

    if ((analysis.repeatedCalls || []).length > 0) {
      md += '\n## Repeated Calls (Potential Optimization)\n';
      md +=
        'Functions called rapidly in succession (possible redundant calls):\n\n';
      md += 'Function | Rapid Calls | Total Time (ms) | File\n';
      md += '---|---|---|---\n';
      (analysis.repeatedCalls || []).forEach((r) => {
        md += `${r.name}|${r.count}|${r.totalDuration.toFixed(0)}|${r.file}\n`;
      });
    }

    fs.writeFileSync(markdownPath, md, 'utf8');
    console.log(`Saved markdown report to ${markdownPath}`);
  }
  return analysis;
}

if (require.main === module) {
  const inputPath =
    process.argv[2] || path.join(defaultOutputDir, 'functions.log');
  const outputPath =
    process.argv[3] ?? path.join(defaultOutputDir, 'report.json');
  const speedscopePath =
    process.argv[4] ?? path.join(defaultOutputDir, 'speedscope.json');
  const markdownPath =
    process.argv[5] ?? path.join(defaultOutputDir, 'report.md');

  const entries = readEntriesFromFile(inputPath);

  if (!entries.length) {
    console.log('No entries with duration found.');
    process.exit(0);
  }

  const analysis = analyzeEntries(entries);

  console.log(`Analyzed ${entries.length} calls from ${inputPath}\n`);
  console.log('=== Top Functions (by p95) ===');
  analysis.functions.forEach((f, idx) => {
    console.log(
      `${idx + 1}. ${f.name} (${f.module}) ${f.file}:${
        f.line || 0
      } - max=${f.max.toFixed(2)}ms p95=${f.p95.toFixed(
        2,
      )}ms avg=${f.avg.toFixed(2)}ms count=${f.count}`,
    );
  });

  console.log('\n=== Modules (by total time) ===');
  analysis.modules.forEach((m) => {
    console.log(
      `- ${m.module}: total=${m.total.toFixed(0)}ms max=${m.max.toFixed(
        2,
      )}ms avg=${m.avg.toFixed(2)}ms samples=${m.count}`,
    );
  });

  console.log('\n=== Pages ===');
  analysis.pages.slice(0, 15).forEach((p) => {
    console.log(
      `- ${p.module}:${p.page} max=${p.max.toFixed(2)}ms avg=${p.avg.toFixed(
        2,
      )}ms samples=${p.count}`,
    );
  });

  if ((analysis.routes || []).length > 0) {
    console.log('\n=== Routes (runtime context) ===');
    analysis.routes.slice(0, 10).forEach((r) => {
      console.log(
        `- ${r.route}: total=${r.total.toFixed(0)}ms max=${r.max.toFixed(
          2,
        )}ms functions=${r.functionCount} calls=${r.count}`,
      );
    });
  }

  if ((analysis.callChains || []).length > 0) {
    console.log('\n=== Hot Call Chains ===');
    analysis.callChains.slice(0, 10).forEach((c, idx) => {
      console.log(
        `${idx + 1}. [${c.total.toFixed(0)}ms total, ${c.count}x] ${c.chain}`,
      );
    });
  }

  if ((analysis.repeatedCalls || []).length > 0) {
    console.log('\n=== Repeated Calls (potential optimization) ===');
    analysis.repeatedCalls.forEach((r) => {
      console.log(
        `- ${r.name} called ${r.count}x rapidly (${r.totalDuration.toFixed(
          0,
        )}ms total)`,
      );
    });
  }

  writeAnalysisOutputs({
    entries,
    reportPath: outputPath,
    speedscopePath,
    markdownPath,
  });
}

module.exports = {
  normalizeEntry,
  readEntriesFromFile,
  analyzeEntries,
  buildSpeedscope,
  writeAnalysisOutputs,
};
