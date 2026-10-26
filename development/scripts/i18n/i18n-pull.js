#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const compatScriptPath = path.resolve(__dirname, 'fs-rmdir-compat.cjs');
const lokaliseClientVersion = '1.2.0';
const outputRootIndex = process.argv.indexOf('--output-root');
if (outputRootIndex !== -1 && !process.argv[outputRootIndex + 1])
  throw new Error('Missing --output-root value.');
const outputRoot =
  outputRootIndex === -1
    ? undefined
    : path.resolve(process.argv[outputRootIndex + 1]);

const expectedProjectIndex = process.argv.indexOf('--expected-project-id');
if (expectedProjectIndex !== -1) {
  const expected = process.argv[expectedProjectIndex + 1];
  const config = require('../../../packages/shared/config/default');
  const projects = config.translations?.projects;
  if (!expected || projects?.length !== 1 || projects[0].id !== expected) {
    throw new Error(
      'Pull configuration differs from the approved Lokalise project.',
    );
  }
}

function getCommandName(command) {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}

function runOrExit(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.signal) {
    process.kill(process.pid, result.signal);
  }
}

const env = {
  ...process.env,
  ...(outputRoot
    ? {
        NODE_CONFIG: JSON.stringify({
          translations: {
            dist: path.join(outputRoot, 'packages/shared/src/locale/json'),
            declaration: {
              dist: path.join(outputRoot, 'packages/shared/src/locale/enum'),
            },
          },
        }),
      }
    : {}),
  NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${compatScriptPath}`]
    .filter(Boolean)
    .join(' '),
};

if (outputRoot) {
  for (const directory of ['json', 'enum'])
    fs.mkdirSync(
      path.join(outputRoot, 'packages/shared/src/locale', directory),
      {
        recursive: true,
      },
    );
}

runOrExit(
  getCommandName('npx'),
  [`lokalise-client@${lokaliseClientVersion}`, 'fetch'],
  { env },
);
runOrExit(process.execPath, [
  path.resolve(__dirname, 'build-locale-json-map.js'),
  ...(outputRoot ? ['--output-root', outputRoot] : []),
]);
