#!/usr/bin/env node

/**
 * Release perf job (one-shot):
 * - Starts performance-server if needed, and stops it on exit (only if it started it).
 * - Runs Detox Android Release (no Metro).
 */

const os = require('os');
const path = require('path');

const { runReleaseJob } = require('./lib/releaseJob');

function main() {
  const repoRoot = path.join(__dirname, '..', '..');
  const sessionsDir =
    process.env.PERF_SESSIONS_DIR || path.join(os.homedir(), 'perf-sessions');
  const serverUrl = process.env.PERF_SERVER_URL || 'http://localhost:9527';

  const args = process.argv.slice(2);
  if (!args.includes('--headless')) args.push('--headless');

  runReleaseJob({
    repoRoot,
    script: 'development/perf-ci/run-android-perf-detox.js',
    args,
    env: {
      DETOX_CONFIGURATION: 'android.emu.release',
      PERF_USE_METRO: '0',
      PERF_SESSIONS_DIR: sessionsDir,
      PERF_SERVER_URL: serverUrl,
      PERF_SERVER_ONESHOT: process.env.PERF_SERVER_ONESHOT || '1',
    },
  });
}

main();
