#!/usr/bin/env node
/* eslint-disable no-restricted-syntax, onekey/no-raw-error -- standalone release entry point */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

const {
  repoRoot,
  prepareEnvironment,
  getCommit,
  createBuildManifest,
  applyManifest,
  packageFirefox,
} = require('./lib/firefox-build');

let yarnShimRoot;

function main() {
  const args = process.argv.slice(2);
  const manifestIndex = args.indexOf('--manifest');
  const install = args.includes('--install');
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--manifest' && args[index + 1]) index += 1;
    else if (args[index] !== '--install')
      throw new Error(
        'Usage: build-firefox.js [--manifest firefox-build.json] [--install]',
      );
  }
  const input =
    manifestIndex >= 0
      ? JSON.parse(
          fs.readFileSync(path.resolve(args[manifestIndex + 1]), 'utf8'),
        )
      : null;
  prepareEnvironment();
  if (input) applyManifest(input);
  else {
    process.env.GITHUB_SHA = getCommit();
    process.env.BUILD_TIME ||= String(Date.now());
    process.env.BUILD_NUMBER ||= '1';
    process.env.BUNDLE_VERSION ||= '1';
  }
  if (fs.existsSync(path.join(repoRoot, '.git'))) {
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (status.trim())
      throw new Error(
        'Commit source changes before creating a reproducible Firefox release.',
      );
  }
  const yarnPath = path.join(
    repoRoot,
    '.yarn/releases',
    `${JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).packageManager.replace('@', '-')}.cjs`,
  );
  yarnShimRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-firefox-yarn-'));
  const quote = (value) => `'${value.replace(/'/g, "'\\''")}'`;
  fs.writeFileSync(
    path.join(yarnShimRoot, 'yarn'),
    `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(yarnPath)} "$@"\n`,
    { mode: 0o755 },
  );
  fs.writeFileSync(
    path.join(yarnShimRoot, 'yarn.cmd'),
    `@echo off\r\n"${process.execPath}" "${yarnPath}" %*\r\n`,
  );
  process.env.PATH = [
    yarnShimRoot,
    path.dirname(process.execPath),
    process.env.PATH,
  ]
    .filter(Boolean)
    .join(path.delimiter);
  const yarn = (argsToRun) =>
    execFileSync(process.execPath, [yarnPath, ...argsToRun], {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit',
    });
  if (install) yarn(['install', '--immutable']);
  require('../../../development/env');
  yarn(['fonts:sync']);
  if (
    !fs
      .readFileSync(
        path.join(
          repoRoot,
          'packages/components/src/hocs/Provider/fonts/brand/manifest.ts',
        ),
        'utf8',
      )
      .includes("source: 'fallback'")
  )
    throw new Error('Expected public fallback fonts.');
  const expected = input || createBuildManifest();
  applyManifest(expected);
  yarn(['app:ext:build']);
  const output = path.join(repoRoot, 'apps/ext/build/firefox_v3');
  const generated = JSON.parse(
    fs.readFileSync(path.join(output, 'firefox-build.json'), 'utf8'),
  );
  if (!isDeepStrictEqual(generated, expected))
    throw new Error(
      'Effective Firefox build parameters differ from the release manifest.',
    );
  console.log(
    `Firefox release: ${packageFirefox(output, path.join(repoRoot, 'apps/ext/build/_dist/firefox'))}`,
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (yarnShimRoot) fs.rmSync(yarnShimRoot, { recursive: true, force: true });
}
