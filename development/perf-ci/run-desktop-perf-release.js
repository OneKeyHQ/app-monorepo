#!/usr/bin/env node

/**
 * Desktop Release perf job (one-shot):
 * - Starts performance-server if needed, and stops it on exit (only if it started it).
 * - Builds production desktop (main + renderer) and runs Electron in PERF_CI_MODE=1.
 */

const path = require('path');

const { runReleaseJob } = require('./lib/releaseJob');

function main() {
  const repoRoot = path.join(__dirname, '..', '..');

  const args = process.argv.slice(2);
  runReleaseJob({
    repoRoot,
    script: 'development/perf-ci/run-desktop-perf.js',
    args,
    env: {
      PERF_SERVER_ONESHOT: process.env.PERF_SERVER_ONESHOT || '1',
    },
  });
}

main();
