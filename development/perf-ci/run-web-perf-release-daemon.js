#!/usr/bin/env node

/**
 * Web Release perf runner (daemon):
 * - Run web release perf jobs on a fixed interval until user terminates this process.
 *
 * Default interval: 6 hours
 * Override via CLI:
 *   node development/perf-ci/run-web-perf-release-daemon.js --interval-minutes 300
 */

const path = require('path');
const { spawn } = require('child_process');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const args = argv.slice();
  const out = { intervalMs: 6 * 60 * 60 * 1000, jobArgs: [] };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--interval-minutes') {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v) && v > 0) out.intervalMs = v * 60 * 1000;
      i += 1;
    } else {
      out.jobArgs.push(a);
    }
  }
  return out;
}

function spawnJob({ repoRoot, jobArgs }) {
  const child = spawn(
    process.execPath,
    ['development/perf-ci/run-web-perf-release.js', ...jobArgs],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        PERF_SERVER_ONESHOT: '0',
      },
    },
  );
  const done = new Promise((resolve) =>
    child.on('close', (c) => resolve(c === null || c === undefined ? 2 : c)),
  );
  return { child, done };
}

async function main() {
  const repoRoot = path.join(__dirname, '..', '..');

  const { intervalMs, jobArgs } = parseArgs(process.argv.slice(2));
  if (!jobArgs.includes('--headless') && !jobArgs.includes('--headed')) {
    // Default to headed for web perf (prepared state often depends on browser extensions).
    jobArgs.push('--headed');
  }

  let stopping = false;
  let activeChild = null;
  const onStop = async () => {
    if (stopping) return;
    stopping = true;
    if (activeChild && activeChild.exitCode === null) {
      activeChild.kill('SIGINT');
    }
    process.exit(0);
  };
  process.on('SIGINT', onStop);
  process.on('SIGTERM', onStop);

  // eslint-disable-next-line no-console
  console.log(`[perf] web release daemon started; intervalMs=${intervalMs}`);

  while (!stopping) {
    const startedAt = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(`[perf] web release job start: ${startedAt}`);
    const { child, done } = spawnJob({ repoRoot, jobArgs });
    activeChild = child;
    // eslint-disable-next-line no-await-in-loop
    await done;
    activeChild = null;
    if (stopping) break;
    await sleep(intervalMs);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e?.stack || e?.message || String(e));
  process.exit(2);
});
