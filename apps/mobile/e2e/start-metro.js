#!/usr/bin/env node

/**
 * Detox "start" wrapper for Metro.
 *
 * Why:
 * - `react-native start` (via yarn scripts) can sometimes fail to terminate cleanly when Detox
 *   sends SIGINT to stop the configured `start` command, causing the whole job to hang after tests.
 * - This wrapper owns the Metro child process and forwards termination signals to it reliably.
 */

const { spawn } = require('child_process');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function killTree(pid, signal) {
  if (!pid) return;
  try {
    // If the child was spawned detached, this targets the whole process group.
    process.kill(-pid, signal);
    return;
  } catch {
    // Fall back to direct pid.
  }
  try {
    process.kill(pid, signal);
  } catch {
    // ignore
  }
}

async function main() {
  const child = spawn('yarn', ['native-bundle'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Avoid Metro trying to use interactive mode in non-TTY environments (e.g. launchd).
      CI: '1',
      // Must be present at bundle-time to avoid "build-time inlining" issues.
      PERF_MONITOR_ENABLED: '1',
      SENTRY_DISABLE_AUTO_UPLOAD: 'true',
    },
    detached: true,
  });

  let stopping = false;
  const stop = async (signal) => {
    if (stopping) return;
    stopping = true;

    killTree(child.pid, signal || 'SIGINT');

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && child.exitCode === null) {
      await sleep(100);
    }
    if (child.exitCode === null) {
      killTree(child.pid, 'SIGKILL');
    }
  };

  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('SIGTERM', () => void stop('SIGTERM'));

  const code = await new Promise((resolve) => {
    child.on('exit', (c) => resolve(c === null || c === undefined ? 0 : c));
  });
  process.exit(code);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e?.stack || e?.message || String(e));
  process.exit(2);
});
