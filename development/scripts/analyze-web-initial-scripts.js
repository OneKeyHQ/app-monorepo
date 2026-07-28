#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const buildDir =
  process.argv[2] || path.join(repoRoot, 'apps', 'web', 'web-build');
const topLimit = Number(process.env.TOP || 60);

const needles = [
  'translations.ts',
  'localforage',
  'WebStorageLegacy',
  'react-hook-form',
  'lru-cache',
  'lodash/lodash.js',
  'lodash/findLastIndex',
  'Icons.tsx',
  'Icons.web.tsx',
  'ses',
  'bn.js',
  '@floating-ui/react',
  'decimal.js/decimal.js',
  'bignumber.js/bignumber.mjs',
  '@tamagui/themes',
  'generated-new.mjs',
  'accountSelector/actions.tsx',
  'accountSelector/actionsLazy.ts',
];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return 'n/a';
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(3)} MiB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${bytes} B`;
}

function getInitialScriptFiles(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter((src) => !/^https?:|^\/\//.test(src))
    .map((src) => src.split('?')[0].replace(/^\//, ''));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const htmlPath = path.join(buildDir, 'index.html');
if (!fs.existsSync(htmlPath)) {
  console.error(`Missing index.html: ${htmlPath}`);
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = getInitialScriptFiles(html);
let totalRawBytes = 0;
const scriptRows = [];

for (const file of scripts) {
  const fullPath = path.join(buildDir, file);
  if (fs.existsSync(fullPath)) {
    const bytes = fs.statSync(fullPath).size;
    totalRawBytes += bytes;
    scriptRows.push({ file, bytes });
  }
}

console.log(`initial scripts: ${scriptRows.length}`);
console.log(`initial script raw size: ${formatBytes(totalRawBytes)}`);

const sourceRows = [];
for (const { file } of scriptRows) {
  const mapPath = path.join(buildDir, `${file}.map`);
  if (fs.existsSync(mapPath)) {
    const map = readJson(mapPath);
    const sources = map.sources || [];
    const contents = map.sourcesContent || [];
    for (let index = 0; index < sources.length; index += 1) {
      sourceRows.push({
        file,
        source: sources[index],
        bytes: Buffer.byteLength(contents[index] || ''),
      });
    }
  }
}

sourceRows.sort((a, b) => b.bytes - a.bytes);

console.log('\nTop source-map modules:');
for (const row of sourceRows.slice(0, topLimit)) {
  console.log(`${String(row.bytes).padStart(8)} ${row.file} ${row.source}`);
}

console.log('\nTracked modules:');
for (const needle of needles) {
  const matches = sourceRows.filter((row) => row.source.includes(needle));
  const sum = matches.reduce((total, row) => total + row.bytes, 0);
  console.log(
    `\n# ${needle}: matches=${matches.length} size=${formatBytes(sum)}`,
  );
  for (const row of matches.slice(0, 30)) {
    console.log(`${String(row.bytes).padStart(8)} ${row.file} ${row.source}`);
  }
}
