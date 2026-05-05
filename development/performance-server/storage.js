/**
 * Storage module for performance data
 *
 * Stores events in JSONL format, organized by session and event type.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const OUTPUT_DIR =
  process.env.PERF_OUTPUT_DIR || path.join(os.homedir(), 'perf-sessions');
const OVERVIEW_PATH = path.join(OUTPUT_DIR, 'sessions.overview.jsonl');

// Ensure output directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getMetaPath(sessionId) {
  return path.join(getSessionDir(sessionId), 'meta.json');
}

function readMeta(sessionId) {
  const metaPath = getMetaPath(sessionId);
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeMeta(sessionId, meta) {
  const metaPath = getMetaPath(sessionId);
  ensureDir(path.dirname(metaPath));
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
}

function appendOverviewLine(summary) {
  ensureDir(OUTPUT_DIR);
  fs.appendFileSync(OVERVIEW_PATH, `${JSON.stringify(summary)}\n`, 'utf8');
}

function buildSessionSummary(meta) {
  const keyMarks =
    meta?.keyMarks && typeof meta.keyMarks === 'object' ? meta.keyMarks : {};
  const startMark = keyMarks['Home:refresh:start:tokens'];
  const doneMark = keyMarks['Home:refresh:done:tokens'];
  const tokensSpanMs =
    Number.isFinite(startMark) && Number.isFinite(doneMark)
      ? doneMark - startMark
      : null;

  const eventCounts = meta?.eventCounts ?? {};
  const functionCallCount = Number.isFinite(eventCounts?.function_call)
    ? eventCounts.function_call
    : null;

  return {
    sessionId: meta?.sessionId || null,
    platform: meta?.platform || 'unknown',
    startTime: meta?.startTime ?? null,
    endTime: meta?.endTime ?? null,
    durationMs: meta?.durationMs ?? null,
    tokensStartMs: Number.isFinite(startMark) ? startMark : null,
    tokensDoneMs: Number.isFinite(doneMark) ? doneMark : null,
    tokensSpanMs,
    functionCallCount,
    eventCounts,
  };
}

// Get session directory path
function getSessionDir(sessionId) {
  return path.join(OUTPUT_DIR, sessionId);
}

// Get log file path for a specific event type
function getLogPath(sessionId, eventType) {
  const sessionDir = getSessionDir(sessionId);
  ensureDir(sessionDir);
  return path.join(sessionDir, `${eventType}.log`);
}

// Append event to the appropriate log file
function appendEvent(sessionId, event) {
  const eventType = event.type || 'unknown';
  const logPath = getLogPath(sessionId, eventType);

  const line = `${JSON.stringify(event)}\n`;
  fs.appendFileSync(logPath, line, 'utf8');

  // Also write to a combined log for easy analysis
  const combinedPath = getLogPath(sessionId, 'all');
  fs.appendFileSync(combinedPath, line, 'utf8');

  // Update session metadata
  updateSessionMeta(sessionId, event);
}

// Update session metadata
function updateSessionMeta(sessionId, event) {
  let meta = {
    sessionId,
    platform: event.platform || 'unknown',
    startTime: Date.now(),
    lastUpdate: Date.now(),
    eventCounts: {},
    keyMarks: {},
  };

  // Load existing meta if exists
  meta = readMeta(sessionId) || meta;

  // Update counts
  const eventType = event.type || 'unknown';
  meta.eventCounts[eventType] = (meta.eventCounts[eventType] || 0) + 1;
  meta.lastUpdate = Date.now();
  if (event.platform) {
    meta.platform = event.platform;
  }

  // Track first-seen timestamps for important marks so we can build quick summaries without scanning logs.
  if (eventType === 'mark') {
    const name = event?.data?.name;
    const ts = event?.timestamp;
    if (typeof name === 'string' && Number.isFinite(ts)) {
      meta.keyMarks =
        meta.keyMarks && typeof meta.keyMarks === 'object' ? meta.keyMarks : {};
      if (!Number.isFinite(meta.keyMarks[name])) {
        meta.keyMarks[name] = ts;
      }
    }
  }

  writeMeta(sessionId, meta);
}

/**
 * Finalize a session (typically on WebSocket close) and append an overview line once.
 *
 * This is best-effort: failures should not crash the server.
 */
function finalizeSession(sessionId, { endTime = Date.now() } = {}) {
  const meta = readMeta(sessionId);
  if (!meta) return null;

  if (!Number.isFinite(meta.startTime)) {
    meta.startTime = endTime;
  }
  meta.endTime = endTime;
  meta.durationMs = Number.isFinite(meta.startTime)
    ? endTime - meta.startTime
    : null;

  // Prevent duplicate overview entries for the same session.
  if (!meta.indexedAt) {
    meta.indexedAt = Date.now();
    appendOverviewLine(buildSessionSummary(meta));
  }

  writeMeta(sessionId, meta);
  return meta;
}

// List all sessions
function listSessions() {
  ensureDir(OUTPUT_DIR);

  const sessions = [];
  const dirs = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true });

  for (const dir of dirs) {
    if (dir.isDirectory()) {
      const sessionId = dir.name;
      const metaPath = path.join(OUTPUT_DIR, sessionId, 'meta.json');

      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          sessions.push(meta);
        } catch {
          // Fallback if meta is corrupted
          sessions.push({
            sessionId,
            platform: 'unknown',
            startTime: fs.statSync(path.join(OUTPUT_DIR, sessionId)).ctimeMs,
          });
        }
      }
    }
  }

  // Sort by start time, newest first
  sessions.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  return sessions;
}

// Get all data for a session
function getSessionData(sessionId) {
  const sessionDir = getSessionDir(sessionId);

  if (!fs.existsSync(sessionDir)) {
    return null;
  }

  const result = {
    sessionId,
    meta: null,
    events: {
      module_load: [],
      function_call: [],
      memory: [],
      fps: [],
      mark: [],
    },
  };

  // Read metadata
  const metaPath = path.join(sessionDir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    try {
      result.meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      // ignore
    }
  }

  // Read each event type
  for (const eventType of Object.keys(result.events)) {
    const logPath = path.join(sessionDir, `${eventType}.log`);
    if (fs.existsSync(logPath)) {
      const lines = fs
        .readFileSync(logPath, 'utf8')
        .split('\n')
        .filter(Boolean);
      result.events[eventType] = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }
  }

  return result;
}

// Clear old sessions (older than N days)
function clearOldSessions(maxAgeDays = 7) {
  ensureDir(OUTPUT_DIR);

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let cleared = 0;

  const dirs = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true });

  for (const dir of dirs) {
    if (dir.isDirectory()) {
      const sessionDir = path.join(OUTPUT_DIR, dir.name);
      const metaPath = path.join(sessionDir, 'meta.json');

      let sessionTime = 0;
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          sessionTime = meta.startTime || 0;
        } catch {
          sessionTime = fs.statSync(sessionDir).ctimeMs;
        }
      } else {
        sessionTime = fs.statSync(sessionDir).ctimeMs;
      }

      if (now - sessionTime > maxAgeMs) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        cleared += 1;
      }
    }
  }

  return cleared;
}

module.exports = {
  OUTPUT_DIR,
  appendEvent,
  finalizeSession,
  OVERVIEW_PATH,
  listSessions,
  getSessionData,
  clearOldSessions,
};
