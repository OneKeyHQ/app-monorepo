#!/usr/bin/env node

/**
 * Ext Release perf job (one-shot):
 * - Starts performance-server if needed, and stops it on exit (only if it started it).
 * - Builds production extension and runs Chromium (headed) via Playwright.
 */

const path = require('path');

const { runReleaseJob } = require('./lib/releaseJob');

function main() {
  const repoRoot = path.join(__dirname, '..', '..');

  const args = process.argv.slice(2);
  runReleaseJob({
    repoRoot,
    script: 'development/perf-ci/run-ext-perf.js',
    args,
    env: {
      PERF_SERVER_ONESHOT: process.env.PERF_SERVER_ONESHOT || '1',
    },
  });
}

main();
