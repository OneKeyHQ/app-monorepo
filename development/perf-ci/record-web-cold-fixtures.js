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
 * Both passes write to a temporary copy; the fixture file is replaced only
 * when every API call of both passes was recorded.
 *
 * PERF_WEB_COLD_RECORD_SOURCE=production|test picks the upstream (default
 * production). PERF_WEB_COLD_SCENARIOS limits the run and keeps the entries
 * of the other scenarios.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  DEFAULT_FIXTURE_PATH,
  writeFileAtomic,
} = require('./lib/webColdNetwork');

const harness = path.join(__dirname, 'run-web-cold.js');
const fixturePath =
  process.env.PERF_WEB_COLD_FIXTURES_PATH || DEFAULT_FIXTURE_PATH;
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

function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-cold-record-'));
  const tempPath = path.join(tempDir, path.basename(fixturePath));
  if (fs.existsSync(fixturePath)) {
    fs.copyFileSync(fixturePath, tempPath);
  }
  try {
    for (const pass of passes) {
      const result = spawnSync(
        process.execPath,
        [harness, ...process.argv.slice(2)],
        {
          stdio: 'inherit',
          env: {
            ...process.env,
            PERF_WEB_COLD_NETWORK: 'record',
            PERF_WEB_COLD_FIXTURES_PATH: tempPath,
            PERF_RUN_COUNT: process.env.PERF_RUN_COUNT || '2',
            // Stay on each page well past the 5 s gate window (and past the
            // app's 15 s deferred refreshes) so slower runners never request
            // an endpoint the recording missed.
            PERF_WEB_COLD_WAIT_AFTER_LOAD_MS:
              process.env.PERF_WEB_COLD_WAIT_AFTER_LOAD_MS || '20000',
            PERF_WEB_COLD_BUDGET_FAIL: '0',
            PERF_WEB_COLD_SKIP_STARTUP_GRAPH_BUDGET: '1',
            ...pass,
          },
        },
      );
      if (result.status !== 0) {
        // eslint-disable-next-line no-console
        console.error(
          `[perf:web:cold:record] recording failed; ${fixturePath} was not changed`,
        );
        return result.status ?? 1;
      }
    }
    // Creates a missing parent folder and replaces the file in one rename.
    writeFileAtomic(fixturePath, fs.readFileSync(tempPath));
    // eslint-disable-next-line no-console
    console.log(`[perf:web:cold:record] updated ${fixturePath}`);
    return 0;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

process.exitCode = main();
