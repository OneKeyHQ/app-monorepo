#!/usr/bin/env node

/**
 * Web Release perf job (one-shot):
 * - Starts performance-server if needed, and stops it on exit (only if it started it).
 * - Builds production web and runs Chromium via Playwright.
 */

const path = require('path');
const { spawn } = require('child_process');

function main() {
  const repoRoot = path.join(__dirname, '..', '..');

  const args = process.argv.slice(2);
  if (!args.includes('--headless') && !args.includes('--headed')) {
    // Default to headed for web perf (prepared state often depends on browser extensions).
    args.push('--headed');
  }

  const child = spawn(
    process.execPath,
    ['development/perf-ci/run-web-perf.js', ...args],
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
