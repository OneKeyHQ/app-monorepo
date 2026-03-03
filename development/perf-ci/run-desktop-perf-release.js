#!/usr/bin/env node

/**
 * Desktop Release perf job (one-shot):
 * - Starts performance-server if needed, and stops it on exit (only if it started it).
 * - Builds production desktop (main + renderer) and runs Electron in PERF_CI_MODE=1.
 */

const path = require('path');
const { spawn } = require('child_process');

function main() {
  const repoRoot = path.join(__dirname, '..', '..');

  const args = process.argv.slice(2);
  const child = spawn(
    process.execPath,
    ['development/perf-ci/run-desktop-perf.js', ...args],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PERF_SERVER_ONESHOT: process.env.PERF_SERVER_ONESHOT || '1',
      },
      stdio: 'inherit',
    },
  );

  child.on('close', (code) =>
    process.exit(code === null || code === undefined ? 2 : code),
  );
}

main();
