#!/usr/bin/env node
/**
 * TypeScript 7 ships the native compiler as `typescript/bin/tsc`, while the
 * legacy `typescript-classic` compatibility package (kept only for scripts that
 * import the classic compiler API) also declares a `tsc` bin. Yarn can link that
 * legacy `tsc` over the TypeScript 7 one, so this postinstall step rewrites the
 * root `node_modules/.bin/tsc` shim to always run the TypeScript 7 native CLI.
 */
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..', '..');
const binDir = path.join(rootDir, 'node_modules', '.bin');
const nativeTscEntry = path.join(
  rootDir,
  'node_modules',
  'typescript',
  'bin',
  'tsc',
);

if (!fs.existsSync(nativeTscEntry)) {
  console.warn(
    '[ensure-native-tsc] TypeScript package not found, skipping tsc shim.',
  );
  process.exit(0);
}

if (process.platform === 'win32') {
  const nodeRelative = path
    .relative(binDir, nativeTscEntry)
    .replace(/\\/gu, '/');
  fs.writeFileSync(
    path.join(binDir, 'tsc.cmd'),
    `@ECHO off\r\nnode "%~dp0/${nodeRelative}" %*\r\n`,
  );
  fs.writeFileSync(
    path.join(binDir, 'tsc.ps1'),
    [
      '#!/usr/bin/env pwsh',
      'if (Get-Command node -ErrorAction SilentlyContinue) {',
      `  node "${path.join(binDir, nodeRelative)}" $args`,
      '  exit $LASTEXITCODE',
      '}',
      'Write-Error "node is required to run tsc"',
      '',
    ].join('\n'),
  );
} else {
  const tscBinPath = path.join(binDir, 'tsc');
  fs.rmSync(tscBinPath, { force: true });
  fs.symlinkSync(path.relative(binDir, nativeTscEntry), tscBinPath);
}

console.log('[ensure-native-tsc] node_modules/.bin/tsc -> TypeScript 7 tsgo');
