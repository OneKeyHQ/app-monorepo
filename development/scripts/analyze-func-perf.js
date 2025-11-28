#!/usr/bin/env node

/**
 * Parse functions.log JSONL and print hottest functions/modules.
 *
 * Usage:
 *   node development/scripts/analyze-func-perf.js [path/to/functions.log] [report.json] [collapsed.txt] [speedscope.json] [report.md]
 */

const fs = require('fs');
const path = require('path');

const inputPath =
  process.argv[2] ||
  path.join(__dirname, '../output/profiler/functions.log');
const outputPath = process.argv[3];
const collapsedPath = process.argv[4];
const speedscopePath = process.argv[5];
const markdownPath = process.argv[6];

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
  if (file.includes('packages/shared/src/engine/')) return 'shared/engine';
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

for (const entry of lines) {
  const key = `${entry.file}:${entry.line || 0}#${entry.name}`;
  const module = entry.module || pickModule(entry.file);
  const page = entry.page || entry.component || 'unknown';
  const existing =
    fnMap.get(key) || { name: entry.name, file: entry.file, line: entry.line, module, page, count: 0, total: 0, max: 0, durations: [] };
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
  const pageEntry =
    pageMap.get(pageKey) || { module, page, count: 0, total: 0, max: 0 };
  pageEntry.count += 1;
  pageEntry.total += entry.duration;
  pageEntry.max = Math.max(pageEntry.max, entry.duration);
  pageMap.set(pageKey, pageEntry);
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
  .sort((a, b) => b.max - a.max);

const hotPages = Array.from(pageMap.values())
  .map((p) => ({
    ...p,
    avg: p.total / p.count,
  }))
  .sort((a, b) => b.max - a.max);

console.log(`Analyzed ${lines.length} calls from ${inputPath}\n`);
console.log('Top functions (by p95):');
hotFns.forEach((f, idx) => {
  console.log(
    `${idx + 1}. ${f.name} (${f.module}) ${f.file}:${f.line || 0} - max=${f.max.toFixed(
      2,
    )}ms p95=${f.p95.toFixed(2)}ms avg=${f.avg.toFixed(2)}ms count=${
      f.count
    }`,
  );
});

console.log('\nModules:');
hotModules.forEach((m) => {
  console.log(
    `- ${m.module}: max=${m.max.toFixed(2)}ms avg=${m.avg.toFixed(
      2,
    )}ms samples=${m.count}`,
  );
});

console.log('\nPages:');
hotPages.slice(0, 20).forEach((p) => {
  console.log(
    `- ${p.module}:${p.page} max=${p.max.toFixed(2)}ms avg=${p.avg.toFixed(
      2,
    )}ms samples=${p.count}`,
  );
});

if (outputPath) {
  const out = {
    summary: {
      totalCalls: lines.length,
      functions: hotFns.length,
      modules: hotModules.length,
      pages: hotPages.length,
    },
    functions: hotFns,
    modules: hotModules,
    pages: hotPages,
  };
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\nSaved analysis to ${outputPath}`);
}

if (collapsedPath) {
  const collapsedMap = new Map();
  for (const entry of lines) {
    const stackFrames = Array.isArray(entry.stack)
      ? entry.stack.map((s) => String(s).replace(/^at\s+/, '').trim())
      : [];
    const frames = [entry.name, ...stackFrames];
    const key = frames.join(';');
    const prev = collapsedMap.get(key) || 0;
    collapsedMap.set(key, prev + entry.duration);
  }
  const buf = Array.from(collapsedMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v.toFixed(3)}`)
    .join('\n');
  fs.writeFileSync(collapsedPath, buf, 'utf8');
  console.log(`Saved collapsed stacks to ${collapsedPath}`);
}

if (speedscopePath) {
  // Minimal speedscope sample profile
  const frames = [];
  const frameIndex = new Map();
  function internFrame(name) {
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
      ? entry.stack.map((s) => String(s))
      : [];
    const framesArr = [entry.name, ...stackFrames].map(internFrame);
    samples.push(framesArr);
    weights.push(entry.duration);
  }
  const profile = {
    type: 'sample',
    name: 'RN Function Perf',
    unit: 'milliseconds',
    startValue: 0,
    endValue: weights.reduce((a, b) => a + b, 0),
    samples,
    weights,
    frames,
  };
  const speedscope = {
    $schema:
      'https://www.speedscope.app/file-format-schema.json',
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
  fs.writeFileSync(markdownPath, md, 'utf8');
  console.log(`Saved markdown report to ${markdownPath}`);
}
