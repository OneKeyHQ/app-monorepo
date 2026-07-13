/* global device */

const fs = require('fs');
const os = require('os');
const path = require('path');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withTimeout(promise, timeoutMs, label) {
  const t0 = Date.now();
  let t;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        t = setTimeout(() => {
          reject(
            new Error(
              `Timeout after ${timeoutMs}ms while waiting for ${label} (elapsed=${
                Date.now() - t0
              }ms)`,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(t);
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function gracefullyTerminateApp() {
  try {
    // The native app uses a boot-fail counter that is reset on background/onStop.
    // `terminateApp()` alone looks like a crash to that recovery mechanism.
    await device.sendToHome();
    await sleep(1000);
  } catch {
    // ignore
  }

  try {
    await device.terminateApp();
  } catch {
    // ignore
  }
}

async function launchAppForPerf({ timeoutMs, label }) {
  const syncArg = process.env.DETOX_ENABLE_SYNCHRONIZATION ?? '0';
  await withTimeout(
    device.launchApp({
      newInstance: true,
      launchArgs: { detoxEnableSynchronization: syncArg },
    }),
    timeoutMs,
    label,
  );
}

function listSessionIds(sessionsDir) {
  if (!fs.existsSync(sessionsDir)) return new Set();
  const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
  return new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));
}

async function waitForNewSessionId({
  sessionsDir,
  beforeSet,
  timeoutMs,
  pollIntervalMs = 250,
}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const now = listSessionIds(sessionsDir);
    for (const id of now) {
      if (!beforeSet.has(id)) return id;
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(
    `Timeout waiting for new sessionId in ${sessionsDir} (timeoutMs=${timeoutMs})`,
  );
}

function safeParseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function pickPayload(event) {
  if (!event || typeof event !== 'object') return null;
  if (event.data && typeof event.data === 'object') return event.data;
  return event;
}

function pickMarkName(event) {
  const payload = pickPayload(event);
  const name = payload?.name ?? event?.name;
  return typeof name === 'string' ? name : null;
}

async function waitForMark({
  markLogPath,
  markName,
  timeoutMs,
  pollIntervalMs = 250,
}) {
  const deadline = Date.now() + timeoutMs;
  let offset = 0;
  let pending = '';

  while (Date.now() < deadline) {
    if (fs.existsSync(markLogPath)) {
      const stat = fs.statSync(markLogPath);
      if (stat.size < offset) {
        offset = 0;
        pending = '';
      }

      if (stat.size !== offset) {
        const fd = fs.openSync(markLogPath, 'r');
        try {
          const buf = Buffer.alloc(stat.size - offset);
          fs.readSync(fd, buf, 0, buf.length, offset);
          offset = stat.size;

          pending += buf.toString('utf8');
          const parts = pending.split('\n');
          pending = parts.pop() || '';

          for (const rawLine of parts) {
            const line = rawLine.trim();
            if (line) {
              const evt = safeParseJsonLine(line);
              const name = pickMarkName(evt);
              if (name === markName) return evt;
            }
          }
        } finally {
          fs.closeSync(fd);
        }
      }
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Timeout waiting for mark "${markName}" in ${markLogPath} (timeoutMs=${timeoutMs})`,
  );
}

describe('Perf Regression Guard (Detox)', () => {
  const sessionsDir =
    process.env.PERF_SESSIONS_DIR || path.join(os.homedir(), 'perf-sessions');
  const markName = process.env.PERF_MARK_NAME || 'Home:refresh:done:tokens';
  const runs = Number(process.env.PERF_RUN_COUNT) || 3;

  const launchTimeoutMs = Number(process.env.PERF_LAUNCH_TIMEOUT_MS) || 120_000;
  const initialLaunchTimeoutMs =
    Number(process.env.PERF_INITIAL_LAUNCH_TIMEOUT_MS) ||
    Math.max(launchTimeoutMs, 180_000);
  const markTimeoutMs = Number(process.env.PERF_MARK_TIMEOUT_MS) || 120_000;
  const sessionTimeoutMs =
    Number(process.env.PERF_SESSION_TIMEOUT_MS) || 5 * 60_000;
  const afterMarkDelayMs = Number(process.env.AFTER_MARK_DELAY_MS) || 4000;
  const prewarmLaunch = process.env.PERF_PREWARM_LAUNCH === '1';
  const prewarmDelayMs = Number(process.env.PERF_PREWARM_DELAY_MS) || 3000;
  const retryTimes = Number(process.env.PERF_DETOX_RETRY_TIMES);

  if (Number.isFinite(retryTimes) && retryTimes > 0) {
    jest.retryTimes(retryTimes, {
      logErrorsBeforeRetry: true,
    });
  }

  const jobOutputDir =
    process.env.PERF_JOB_OUTPUT_DIR ||
    path.join(process.cwd(), 'e2e', 'artifacts', 'perf-job');
  const outRunsPath = path.join(jobOutputDir, 'runs.json');

  const startedAt = new Date().toISOString();
  const results = [];

  beforeAll(() => {
    ensureDir(jobOutputDir);
    writeJson(outRunsPath, { startedAt, sessionsDir, runs: results });
  });

  beforeAll(async () => {
    // Android Debug needs adb reverse for Metro (device-side localhost:8081 -> host 8081).
    if (process.env.PERF_USE_METRO !== '0') {
      try {
        await device.reverseTcpPort(8081);
      } catch {
        // ignore (no-op on iOS)
      }
    }

    // With `detox test --reuse`, Detox won't delete+reinstall the app.
    // We still install/update the app binary here so the currently-installed app is Detox-enabled.
    // If you need to preserve a special pre-configured simulator state and want to skip install,
    // set PERF_SKIP_INSTALL_APP=1 (note: then the already-installed app must be Detox-enabled).
    if (process.env.PERF_SKIP_INSTALL_APP !== '1') {
      await device.installApp();
    }

    if (prewarmLaunch) {
      // The first post-install launch on iOS release can be much slower due to simulator/app initialization.
      // Warm it up outside the measured runs so the 3 sampled runs are stable.
      // eslint-disable-next-line no-console
      console.log('[perf] warmup: launch');
      await launchAppForPerf({
        timeoutMs: initialLaunchTimeoutMs,
        label: 'launchApp warmup',
      });
      await sleep(prewarmDelayMs);
      await gracefullyTerminateApp();
      await sleep(1000);
    }
  });

  afterAll(async () => {
    await gracefullyTerminateApp();
  });

  const runIndices = Array.from({ length: runs }, (_, i) => i + 1);

  test.each(runIndices)(
    'run #%i: collects a session and waits for Home:refresh:done:tokens',
    async (runIndex) => {
      const runStart = Date.now();
      // eslint-disable-next-line no-console
      console.log(`[perf] run#${runIndex}: launch`);

      const before = listSessionIds(sessionsDir);

      await launchAppForPerf({
        timeoutMs: launchTimeoutMs,
        label: 'launchApp',
      });

      const sessionId = await waitForNewSessionId({
        sessionsDir,
        beforeSet: before,
        timeoutMs: sessionTimeoutMs,
      });
      // eslint-disable-next-line no-console
      console.log(`[perf] run#${runIndex}: sessionId=${sessionId}`);

      await waitForMark({
        markLogPath: path.join(sessionsDir, sessionId, 'mark.log'),
        markName,
        timeoutMs: markTimeoutMs,
      });

      await sleep(afterMarkDelayMs);
      await gracefullyTerminateApp();
      await sleep(750);

      results.push({
        runIndex,
        sessionId,
        markName,
        durations: { totalMs: Date.now() - runStart },
      });
      writeJson(outRunsPath, { startedAt, sessionsDir, runs: results });
    },
  );
});
