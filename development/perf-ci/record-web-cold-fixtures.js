#!/usr/bin/env node

/**
 * Re-records the API fixtures replayed by run-web-cold.js.
 *
 * Runs the cold scenarios twice in record mode: first with the 4-vCPU CI
 * device profile (no tab preloading), then with this machine's own profile,
 * so the fixture file covers the requests either profile makes. Each page is
 * held for 20 s to catch late requests. Extra args (e.g. --skip-build,
 * --headed) are passed through to both passes.
 *
 * PERF_WEB_COLD_RECORD_SOURCE=production|test picks the upstream (default
 * production). PERF_WEB_COLD_SCENARIOS limits the run and keeps the entries
 * of the other scenarios.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const harness = path.join(__dirname, 'run-web-cold.js');
const fresh =
  process.env.PERF_WEB_COLD_RECORD_FRESH ??
  (process.env.PERF_WEB_COLD_SCENARIOS ? '0' : '1');

const passes = [
  {
    PERF_WEB_COLD_RECORD_FRESH: fresh,
    PERF_WEB_COLD_HARDWARE_CONCURRENCY: '4',
  },
  {
    PERF_SKIP_BUILD: '1',
    PERF_WEB_COLD_RECORD_FRESH: '0',
    PERF_WEB_COLD_HARDWARE_CONCURRENCY: '',
  },
];

for (const pass of passes) {
  const result = spawnSync(
    process.execPath,
    [harness, ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        PERF_WEB_COLD_NETWORK: 'record',
        PERF_RUN_COUNT: process.env.PERF_RUN_COUNT || '2',
        // Stay on each page well past the 5 s gate window (and past the
        // app's 15 s deferred refreshes) so slower runners never request an
        // endpoint the recording missed.
        PERF_WEB_COLD_WAIT_AFTER_LOAD_MS:
          process.env.PERF_WEB_COLD_WAIT_AFTER_LOAD_MS || '20000',
        PERF_WEB_COLD_BUDGET_FAIL: '0',
        PERF_WEB_COLD_SKIP_STARTUP_GRAPH_BUDGET: '1',
        ...pass,
      },
    },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
