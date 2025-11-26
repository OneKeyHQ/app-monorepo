#!/usr/bin/env node

/**
 * Parse functions.log JSONL and print hottest functions/modules.
 *
 * Usage:
 *   node development/scripts/analyze-func-perf.js [path/to/functions.log]
 */

const fs = require('fs');
const path = require('path');

const inputPath =
  process.argv[2] ||
  path.join(__dirname, '../output/profiler/functions.log');
const outputPath = process.argv[3];
const collapsedPath = process.argv[4];

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
  .filter((e) => typeof e.duration === 'number');

if (!lines.length) {
  console.log('No entries with duration found.');
  process.exit(0);
}

const fnMap = new Map();
const moduleMap = new Map();

for (const entry of lines) {
  const key = `${entry.file}:${entry.line || 0}#${entry.name}`;
  const module = pickModule(entry.file);
  const existing =
    fnMap.get(key) || { name: entry.name, file: entry.file, line: entry.line, module, count: 0, total: 0, max: 0, durations: [] };
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

if (outputPath) {
  const out = {
    summary: {
      totalCalls: lines.length,
      functions: hotFns.length,
      modules: hotModules.length,
    },
    functions: hotFns,
    modules: hotModules,
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
