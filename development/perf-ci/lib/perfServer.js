const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ensureDir } = require('./fs');

async function checkPerfServer(serverUrl) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/health`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const json = await res.json().catch(() => null);
    if (!json || json.ok !== true) throw new Error('Invalid health response');
    return json;
  } finally {
    clearTimeout(t);
  }
}

function normalizePath(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function startPerfServer({
  repoRoot,
  sessionsDir,
  serverUrl,
  outputDir,
  detached = true,
}) {
  const url = new URL(serverUrl);
  const port = url.port || '9527';
  const scriptPath = path.join(
    repoRoot,
    'development',
    'performance-server',
    'server.js',
  );

  const logOutPath = path.join(outputDir, 'perf-server.log');
  const logErrPath = path.join(outputDir, 'perf-server.error.log');
  ensureDir(outputDir);

  const outFd = fs.openSync(logOutPath, 'a');
  const errFd = fs.openSync(logErrPath, 'a');

  const child = spawn(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PERF_OUTPUT_DIR: sessionsDir,
      PERF_SERVER_PORT: String(port),
    },
    stdio: ['ignore', outFd, errFd],
    detached: Boolean(detached),
  });

  // Parent should not keep log fds open.
  fs.closeSync(outFd);
  fs.closeSync(errFd);

  if (detached) child.unref();

  return { child, pid: child.pid, logOutPath, logErrPath };
}

async function ensurePerfServerRunning({
  repoRoot,
  sessionsDir,
  serverUrl,
  outputDir,
  oneshot = false,
}) {
  const desiredDir = normalizePath(sessionsDir);

  let health = null;
  try {
    health = await checkPerfServer(serverUrl);
  } catch {
    health = null;
  }

  if (health) {
    const actualDir = health?.outputDir
      ? normalizePath(health.outputDir)
      : null;
    if (actualDir && actualDir !== desiredDir) {
      throw new Error(
        `performance-server is running but outputDir differs.\n` +
          `- server outputDir: ${health.outputDir}\n` +
          `- job sessionsDir: ${sessionsDir}\n` +
          `Fix by restarting performance-server with PERF_OUTPUT_DIR="${sessionsDir}" (or set PERF_SESSIONS_DIR to match).`,
      );
    }
    return { started: false, health };
  }

  const started = startPerfServer({
    repoRoot,
    sessionsDir,
    serverUrl,
    outputDir,
    detached: !oneshot,
  });
  const deadline =
    Date.now() + (Number(process.env.PERF_SERVER_START_TIMEOUT_MS) || 20_000);
  let lastErr = null;

  while (Date.now() < deadline) {
    try {
      const health = await checkPerfServer(serverUrl);
      const actualDir = health?.outputDir
        ? normalizePath(health.outputDir)
        : null;
      if (actualDir && actualDir !== desiredDir) {
        throw new Error(
          `Started performance-server but outputDir differs.\n` +
            `- server outputDir: ${health.outputDir}\n` +
            `- job sessionsDir: ${sessionsDir}`,
        );
      }
      return { started: true, health, ...started };
    } catch (e) {
      lastErr = e;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 500));
  }

  const msg = lastErr?.message || String(lastErr);
  throw new Error(
    `Failed to start performance-server at ${serverUrl}.\n` +
      `PID: ${started.pid}\n` +
      `Logs:\n- ${started.logOutPath}\n- ${started.logErrPath}\n` +
      `Last error: ${msg}`,
  );
}

async function stopChild(child) {
  if (!child) return;
  if (child.exitCode !== null) return;

  child.kill('SIGTERM');
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && child.exitCode === null) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 100));
  }
  if (child.exitCode === null) child.kill('SIGKILL');
}

module.exports = {
  checkPerfServer,
  ensurePerfServerRunning,
  normalizePath,
  startPerfServer,
  stopChild,
};
