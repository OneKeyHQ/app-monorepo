#!/usr/bin/env node

/**
 * Performance Monitoring Server
 *
 * Receives performance data via WebSocket and stores it for analysis.
 *
 * Usage:
 *   node development/performance-server/server.js
 *
 * Environment variables:
 *   PERF_SERVER_PORT - Server port (default: 9527)
 *   PERF_OUTPUT_DIR  - Output directory (default: $HOME/perf-sessions)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const storage = require('./storage');
const derivedLib = require('./derived');

const PORT = parseInt(process.env.PERF_SERVER_PORT || '9527', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

const SESSION_CACHE_MAX = 4;
const sessionCache = new Map();

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// Active sessions (for real-time updates)
const activeSessions = new Map();

// HTTP server for static files and API
const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API routes
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'api' && segments[1] === 'health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(
        {
          ok: true,
          port: PORT,
          outputDir: storage.OUTPUT_DIR,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (segments[0] === 'api' && segments[1] === 'sessions') {
    const sessionId = segments[2];
    const action = segments[3];
    if (!sessionId) {
      handleGetSessions(req, res);
      return;
    }
    if (action === 'analysis') {
      handleGetSessionAnalysis(req, res, sessionId);
      return;
    }
    if (action === 'slow-functions') {
      handleGetSessionSlowFunctions(req, res, sessionId, url);
      return;
    }
    if (action === 'repeated-calls') {
      handleGetSessionRepeatedCalls(req, res, sessionId, url);
      return;
    }
    if (action === 'speedscope') {
      handleGetSessionSpeedscope(req, res, sessionId);
      return;
    }
    if (action === 'low-fps') {
      handleGetSessionLowFps(req, res, sessionId, url);
      return;
    }
    if (action === 'jsblock') {
      handleGetSessionJsBlock(req, res, sessionId, url);
      return;
    }
    if (action === 'key-marks') {
      handleGetSessionKeyMarks(req, res, sessionId);
      return;
    }
    if (action === 'home-refresh') {
      handleGetSessionHomeRefresh(req, res, sessionId, url);
      return;
    }
    handleGetSession(req, res, sessionId);
    return;
  }

  // Static files
  const filePath = path.join(
    PUBLIC_DIR,
    url.pathname === '/' ? 'index.html' : url.pathname,
  );

  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// WebSocket server
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${clientIp}`);

  let sessionId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      // First message should contain sessionId
      if (!sessionId && message.sessionId) {
        sessionId = message.sessionId;
        activeSessions.set(sessionId, {
          ws,
          startTime: Date.now(),
          platform: message.platform || 'unknown',
          eventCount: 0,
        });
        console.log(
          `[WS] Session started: ${sessionId} (${
            message.platform || 'unknown'
          })`,
        );
      }

      if (sessionId) {
        // Store the event
        storage.appendEvent(sessionId, message);

        // Update session stats
        const session = activeSessions.get(sessionId);
        if (session) {
          session.eventCount += 1;
        }
      }
    } catch (err) {
      console.error('[WS] Failed to parse message:', err.message);
    }
  });

  ws.on('close', () => {
    if (sessionId) {
      const session = activeSessions.get(sessionId);
      if (session) {
        console.log(
          `[WS] Session ended: ${sessionId} (${session.eventCount} events)`,
        );
        activeSessions.delete(sessionId);
      }
      try {
        storage.finalizeSession(sessionId);
      } catch (err) {
        console.error(
          `[WS] Failed to finalize session ${sessionId}:`,
          err?.message || String(err),
        );
      }
    }
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
  });
});

// API handlers
function clampInt(n, min, max, fallback) {
  if (n === null || n === undefined || n === '') return fallback;
  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;
  const int = Math.trunc(num);
  return Math.min(Math.max(int, min), max);
}

function getSessionCacheKey(sessionId) {
  return derivedLib.getSessionCacheKey(sessionId);
}

function getSessionDerived(sessionId) {
  const cacheKey = getSessionCacheKey(sessionId);
  if (!cacheKey) return null;

  const cached = sessionCache.get(sessionId);
  if (cached && cached.cacheKey === cacheKey) {
    // refresh LRU order
    sessionCache.delete(sessionId);
    sessionCache.set(sessionId, cached);
    return cached.value;
  }

  const value = derivedLib.computeSessionDerived(sessionId);

  sessionCache.set(sessionId, { cacheKey, value });
  while (sessionCache.size > SESSION_CACHE_MAX) {
    const oldestKey = sessionCache.keys().next().value;
    sessionCache.delete(oldestKey);
  }

  return value;
}

function paginate(list, page, pageSize) {
  const total = list.length;
  const size = Math.max(pageSize, 1);
  const totalPages = Math.max(Math.ceil(total / size), 1);
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * size;
  const end = start + size;
  return {
    total,
    page: currentPage,
    pageSize: size,
    totalPages,
    items: list.slice(start, end),
  };
}

function handleGetSessions(req, res) {
  try {
    const sessions = storage.listSessions();

    // Add active session info
    const result = sessions.map((s) => ({
      ...s,
      active: activeSessions.has(s.sessionId),
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[API] Error listing sessions:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleGetSession(req, res, sessionId) {
  try {
    const data = storage.getSessionData(sessionId);
    if (!data) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    console.error('[API] Error getting session:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleGetSessionAnalysis(req, res, sessionId) {
  try {
    const derived = getSessionDerived(sessionId);
    if (!derived) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    const moduleSet = new Set(derived.modules);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        sessionId,
        totalEntries: derived.entries.length,
        timeRange: derived.timeRange,
        modules: Array.from(moduleSet),
        analysis: derived.analysis,
        meta: derived.meta || null,
      }),
    );
  } catch (err) {
    console.error('[API] Error analyzing session:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleGetSessionSlowFunctions(req, res, sessionId, url) {
  try {
    const derived = getSessionDerived(sessionId);
    if (!derived) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    const page = clampInt(url.searchParams.get('page'), 1, 1_000_000, 1);
    const pageSize = clampInt(url.searchParams.get('pageSize'), 1, 200, 50);
    const moduleFilter = url.searchParams.get('module') || 'all';
    const thresholdMs = Number(url.searchParams.get('thresholdMs') || 0) || 0;
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const sort = (url.searchParams.get('sort') || 'p95').toLowerCase();
    const order = (url.searchParams.get('order') || 'desc').toLowerCase();

    let list = derived.slowFunctions;
    if (moduleFilter && moduleFilter !== 'all') {
      list = list.filter((f) => f.module === moduleFilter);
    }
    if (thresholdMs > 0) {
      list = list.filter((f) => f.max >= thresholdMs || f.p95 >= thresholdMs);
    }
    if (search) {
      list = list.filter((f) =>
        `${f.name} ${f.file} ${f.module}`.toLowerCase().includes(search),
      );
    }

    const key = ['p95', 'max', 'avg', 'count', 'total'].includes(sort)
      ? sort
      : 'p95';
    const dir = order === 'asc' ? 1 : -1;
    list = [...list].toSorted((a, b) => {
      const primary = dir * ((a[key] || 0) - (b[key] || 0));
      if (primary !== 0) return primary;
      return b.p95 - a.p95 || b.max - a.max || b.total - a.total;
    });

    const paged = paginate(list, page, pageSize);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        sessionId,
        ...paged,
        filters: {
          module: moduleFilter,
          thresholdMs,
          search,
          sort: key,
          order: order === 'asc' ? 'asc' : 'desc',
        },
      }),
    );
  } catch (err) {
    console.error('[API] Error building slow functions:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleGetSessionRepeatedCalls(req, res, sessionId, url) {
  try {
    const derived = getSessionDerived(sessionId);
    if (!derived) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    const modeRaw = (url.searchParams.get('mode') || 'rapid').toLowerCase();
    const mode = ['rapid', 'overall'].includes(modeRaw) ? modeRaw : 'rapid';

    const page = clampInt(url.searchParams.get('page'), 1, 1_000_000, 1);
    const pageSize = clampInt(url.searchParams.get('pageSize'), 1, 200, 20);
    const moduleFilter = url.searchParams.get('module') || 'all';
    const minCount = clampInt(
      url.searchParams.get('minCount'),
      1,
      1_000_000,
      3,
    );
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();

    let list =
      mode === 'overall'
        ? derived.repeatedCallsOverall.filter((r) => r.calls >= minCount)
        : derived.repeatedCalls.filter((r) => r.count >= minCount);
    if (moduleFilter && moduleFilter !== 'all') {
      list = list.filter((r) => r.module === moduleFilter);
    }
    if (search) {
      list = list.filter((r) =>
        `${r.name} ${r.file} ${r.module}`.toLowerCase().includes(search),
      );
    }

    const paged = paginate(list, page, pageSize);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        sessionId,
        ...paged,
        filters: {
          module: moduleFilter,
          minCount,
          search,
          mode,
          windowMs: mode === 'rapid' ? 100 : undefined,
        },
      }),
    );
  } catch (err) {
    console.error('[API] Error building repeated calls:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleGetSessionSpeedscope(req, res, sessionId) {
  try {
    const derived = getSessionDerived(sessionId);
    if (!derived) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }
    const analyzer = require('../scripts/analyze-func-perf');
    const speedscope = analyzer.buildSpeedscope(
      derived.entries,
      `Session ${sessionId}`,
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(speedscope));
  } catch (err) {
    console.error('[API] Error building speedscope:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleGetSessionLowFps(req, res, sessionId, url) {
  try {
    const thresholdFps = clampInt(url.searchParams.get('threshold'), 1, 60, 10);
    const topWindows = clampInt(url.searchParams.get('topWindows'), 1, 50, 10);
    const topFunctions = clampInt(
      url.searchParams.get('topFunctions'),
      1,
      100,
      25,
    );

    const result = derivedLib.computeSessionLowFpsHotspots(sessionId, {
      thresholdFps,
      topWindows,
      topFunctions,
    });

    if (!result) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[API] Error computing low FPS hotspots:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleGetSessionJsBlock(req, res, sessionId, url) {
  try {
    const topWindows = clampInt(url.searchParams.get('topWindows'), 1, 50, 10);
    const topFunctions = clampInt(
      url.searchParams.get('topFunctions'),
      1,
      100,
      25,
    );
    const minDriftMs = clampInt(
      url.searchParams.get('minDrift'),
      50,
      30_000,
      50,
    );

    const result = derivedLib.computeSessionJsBlockHotspots(sessionId, {
      topWindows,
      topFunctions,
      minDriftMs,
    });

    if (!result) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[API] Error computing jsblock hotspots:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleGetSessionKeyMarks(req, res, sessionId) {
  try {
    const result = derivedLib.computeSessionKeyMarks(sessionId, {
      names: [
        'app:start',
        'Home:refresh:start:tokens',
        'Home:refresh:done:tokens',
        'Home:done:tokens',
        'Home:overview:mount',
        'Home:overview:unmount',
        'AllNet:useAllNetworkRequests:start',
        'AllNet:getAllNetworkAccounts:start',
        'AllNet:getAllNetworkAccounts:done',
        'AllNet:requests:start',
        'AllNet:requests:done',
      ],
    });

    if (!result) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[API] Error computing key marks:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleGetSessionHomeRefresh(req, res, sessionId, url) {
  try {
    const topFunctions = clampInt(
      url.searchParams.get('topFunctions'),
      1,
      100,
      25,
    );

    const keyMarks = derivedLib.computeSessionKeyMarks(sessionId, {
      names: ['Home:refresh:start:tokens', 'Home:refresh:done:tokens'],
    });

    if (!keyMarks) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    const start = keyMarks.marks?.['Home:refresh:start:tokens']?.first?.t;
    const end = keyMarks.marks?.['Home:refresh:done:tokens']?.first?.t;

    if (!start || !end || end <= start) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: 'Home refresh marks not found', keyMarks }),
      );
      return;
    }

    const span = derivedLib.computeSessionSpanHotspots(sessionId, {
      start,
      end,
      topFunctions,
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        sessionStart: keyMarks.sessionStart,
        startSinceSessionStartMs: keyMarks.sessionStart
          ? start - keyMarks.sessionStart
          : null,
        endSinceSessionStartMs: keyMarks.sessionStart
          ? end - keyMarks.sessionStart
          : null,
        ...span,
      }),
    );
  } catch (err) {
    console.error('[API] Error computing home refresh hotspots:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function startServer() {
  httpServer.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('  OneKey Performance Monitor Server');
    console.log('='.repeat(60));
    console.log('');
    console.log(`  WebSocket:  ws://localhost:${PORT}`);
    console.log(`  Dashboard:  http://localhost:${PORT}`);
    console.log(`  API:        http://localhost:${PORT}/api/sessions`);
    console.log('');
    console.log(`  Output:     ${storage.OUTPUT_DIR}`);
    console.log('');
    console.log('  Waiting for connections...');
    console.log('');
  });

  process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');
    wss.close();
    httpServer.close();
    process.exit(0);
  });
}

if (require.main === module) {
  startServer();
}
