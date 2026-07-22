#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { splitArgumentsByLength } = require('./command-batches');

const FORMAT_FILE_RE = /\.(?:cjs|js|jsx|mjs|ts|tsx)$/u;
const TYPESCRIPT_FILE_RE = /\.(?:ts|tsx)$/u;
const TYPESCRIPT_LINT_EXCLUDED_FILES = new Set([
  'packages/shared/src/locale/enum/translations.ts',
  'packages/shared/src/locale/localeJsonMap.ts',
]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status || 1);
  }

  return result.stdout || '';
}

function resolvePackageBinary(packageName) {
  const manifestPath = require.resolve(`${packageName}/package.json`, {
    paths: [process.cwd()],
  });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const relativeBinPath =
    typeof manifest.bin === 'string'
      ? manifest.bin
      : manifest.bin &&
        (manifest.bin[packageName] || Object.values(manifest.bin)[0]);

  if (!relativeBinPath) {
    throw new Error(`Unable to resolve binary for package: ${packageName}`);
  }

  return path.resolve(path.dirname(manifestPath), relativeBinPath);
}

function runPackageBinaryInBatches(packageName, fixedArgs, files) {
  const binaryPath = resolvePackageBinary(packageName);
  const batches = splitArgumentsByLength({
    command: process.execPath,
    fixedArgs: [binaryPath, ...fixedArgs],
    values: files,
  });

  for (const batch of batches) {
    run(process.execPath, [binaryPath, ...fixedArgs, ...batch], {
      stdio: 'inherit',
    });
  }
}

function getStagedFiles() {
  return run('git', [
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMR',
    '-z',
    '--',
  ])
    .split('\0')
    .filter(Boolean);
}

function format(files) {
  if (!files.length) {
    return;
  }

  runPackageBinaryInBatches(
    'oxfmt',
    ['--no-error-on-unmatched-pattern'],
    files,
  );
}

function lint(files) {
  if (!files.length) {
    return;
  }

  runPackageBinaryInBatches(
    'oxlint',
    [
      '--tsconfig',
      './tsconfig.json',
      '--type-aware',
      '--fix',
      '--deny-warnings',
    ],
    files,
  );
}

function main() {
  const args = process.argv.slice(2);
  const formatOnly = args.length === 1 && args[0] === '--format-only';

  if (args.length && !formatOnly) {
    throw new Error(`Unknown argument: ${args.join(' ')}`);
  }

  const files = getStagedFiles();
  if (!formatOnly) {
    lint(
      files.filter(
        (file) =>
          TYPESCRIPT_FILE_RE.test(file) &&
          !TYPESCRIPT_LINT_EXCLUDED_FILES.has(file),
      ),
    );
  }
  format(files.filter((file) => FORMAT_FILE_RE.test(file)));
}

main();
