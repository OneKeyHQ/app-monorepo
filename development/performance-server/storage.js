/**
 * Storage module for performance data
 *
 * Stores events in JSONL format, organized by session and event type.
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR =
  process.env.PERF_OUTPUT_DIR ||
  path.join(__dirname, '../output/perf-sessions');

// Ensure output directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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
  const sessionDir = getSessionDir(sessionId);
  const metaPath = path.join(sessionDir, 'meta.json');

  let meta = {
    sessionId,
    platform: event.platform || 'unknown',
    startTime: Date.now(),
    lastUpdate: Date.now(),
    eventCounts: {},
  };

  // Load existing meta if exists
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      // ignore parse errors
    }
  }

  // Update counts
  const eventType = event.type || 'unknown';
  meta.eventCounts[eventType] = (meta.eventCounts[eventType] || 0) + 1;
  meta.lastUpdate = Date.now();
  if (event.platform) {
    meta.platform = event.platform;
  }

  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
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
  listSessions,
  getSessionData,
  clearOldSessions,
};
