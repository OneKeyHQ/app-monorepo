#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const compatScriptPath = path.resolve(__dirname, 'fs-rmdir-compat.cjs');
const lokaliseClientVersion = '1.2.0';

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
  NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${compatScriptPath}`]
    .filter(Boolean)
    .join(' '),
};

runOrExit(
  getCommandName('npx'),
  [`lokalise-client@${lokaliseClientVersion}`, 'fetch'],
  { env },
);
runOrExit(process.execPath, [
  path.resolve(__dirname, 'build-locale-json-map.js'),
]);
