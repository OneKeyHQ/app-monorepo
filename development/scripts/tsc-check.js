#!/usr/bin/env node
/* cspell:words GOMEMLIMIT GOGC tsgo */

const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const DEFAULT_CHECKERS = '2';
const DEFAULT_GOMEMLIMIT = '8GiB';
const DEFAULT_GOGC = '50';

function getYarnCacheFolder(cwd = ROOT_DIR) {
  const yarnCmd = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  return execFileSync(yarnCmd, ['config', 'get', 'cacheFolder'], {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }).trim();
}

function resolveTscEntry(rootDir = ROOT_DIR) {
  const typescriptPackage = require.resolve('typescript/package.json', {
    paths: [rootDir],
  });
  return path.join(path.dirname(typescriptPackage), 'bin', 'tsc');
}

function buildTscInvocation({
  rootDir = ROOT_DIR,
  cacheFolder,
  extraArgs = [],
  pretty = true,
  defaultGoMemLimit = DEFAULT_GOMEMLIMIT,
  env = process.env,
}) {
  const tsConfigPath = path.join(rootDir, 'tsconfig.json');
  const tsBuildInfoPath = path.join(cacheFolder, '.app-mono-ts-cache');
  const checkers = env.ONEKEY_TSC_CHECKERS || DEFAULT_CHECKERS;

  const args = [
    resolveTscEntry(rootDir),
    '-p',
    tsConfigPath,
    '--noEmit',
    '--tsBuildInfoFile',
    tsBuildInfoPath,
    '--checkers',
    checkers,
    ...(pretty ? ['--pretty'] : []),
    ...extraArgs,
  ];

  // Limit tsgo parallel checker count and Go GC headroom so pre-commit checks
  // do not balloon to 10-16 GiB RSS on developer machines.
  const childEnv = {
    ...env,
    GOMEMLIMIT: env.GOMEMLIMIT || defaultGoMemLimit,
    GOGC: env.GOGC || DEFAULT_GOGC,
  };

  return {
    command: process.execPath,
    args,
    env: childEnv,
  };
}

function main() {
  const cacheFolder = getYarnCacheFolder(ROOT_DIR);
  const { command, args, env } = buildTscInvocation({
    rootDir: ROOT_DIR,
    cacheFolder,
    extraArgs: process.argv.slice(2),
    env: process.env,
  });

  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_CHECKERS,
  DEFAULT_GOGC,
  DEFAULT_GOMEMLIMIT,
  buildTscInvocation,
};
