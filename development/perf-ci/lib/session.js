const fs = require('fs');
const path = require('path');

const { fileExists } = require('./fs');

function ensureSessionsDirWritable(sessionsDir) {
  try {
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.accessSync(sessionsDir, fs.constants.R_OK);
    fs.accessSync(sessionsDir, fs.constants.W_OK);
  } catch (e) {
    const err = e?.message || String(e);
    throw new Error(
      [
        `PERF_SESSIONS_DIR is not writable: ${sessionsDir}`,
        err,
        '',
        'Fix options:',
        '- Point PERF_SESSIONS_DIR (and PERF_OUTPUT_DIR for performance-server) to a writable folder, e.g. ~/perf-sessions',
        '- Or pre-create the directory with correct ownership/permissions on the test machine',
      ].join('\n'),
      { cause: e },
    );
  }
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

function findFirstMarkTimestamp({ markLogPath, markName }) {
  const raw = fs.readFileSync(markLogPath, 'utf8');
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (line) {
      const evt = safeParseJsonLine(line);
      if (evt) {
        const name = pickMarkName(evt);
        if (name === markName) {
          const ts = evt.timestamp ?? pickPayload(evt)?.timestamp ?? null;
          return Number.isFinite(ts) ? ts : null;
        }
      }
    }
  }
  return null;
}

function countJsonlLines(filePath) {
  // Fast count: each event is a single line ending with '\n'.
  const buf = fs.readFileSync(filePath);
  let n = 0;
  for (let i = 0; i < buf.length; i += 1) {
    if (buf[i] === 10) n += 1;
  }
  return n;
}

function readSessionMetrics({ sessionsDir, sessionId }) {
  const sessionDir = path.join(sessionsDir, sessionId);

  const markLogPath = path.join(sessionDir, 'mark.log');
  const startMs = fileExists(markLogPath)
    ? findFirstMarkTimestamp({
        markLogPath,
        markName: 'Home:refresh:start:tokens',
      })
    : null;
  const doneMs = fileExists(markLogPath)
    ? findFirstMarkTimestamp({
        markLogPath,
        markName: 'Home:refresh:done:tokens',
      })
    : null;
  const spanMs =
    Number.isFinite(startMs) && Number.isFinite(doneMs)
      ? doneMs - startMs
      : null;

  const functionCallsPath = path.join(sessionDir, 'function_call.log');
  const functionCallCount = fileExists(functionCallsPath)
    ? countJsonlLines(functionCallsPath)
    : null;

  return {
    tokensStartMs: startMs,
    tokensSpanMs: spanMs,
    functionCallCount,
  };
}

function listSessionIds(sessionsDir) {
  if (!fs.existsSync(sessionsDir)) return new Set();
  const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
  return new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
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
    // eslint-disable-next-line no-await-in-loop
    await sleep(pollIntervalMs);
  }
  throw new Error(
    `Timeout waiting for new sessionId in ${sessionsDir} (timeoutMs=${timeoutMs})`,
  );
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

    // eslint-disable-next-line no-await-in-loop
    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Timeout waiting for mark "${markName}" in ${markLogPath} (timeoutMs=${timeoutMs})`,
  );
}

module.exports = {
  countJsonlLines,
  ensureSessionsDirWritable,
  findFirstMarkTimestamp,
  listSessionIds,
  pickMarkName,
  pickPayload,
  readSessionMetrics,
  safeParseJsonLine,
  waitForMark,
  waitForNewSessionId,
};
