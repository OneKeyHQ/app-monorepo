const fs = require('fs');
const path = require('path');
const storage = require('./storage');
const analyzer = require('../scripts/analyze-func-perf');

const CALLBACKISH_FUNCTION_NAME_PATTERNS = [
  /^anonymous$/i,
  /^@useCallback$/i,
  /^@usePromiseResult$/i,
  /^@mapCallback$/i,
  /^\w+@useCallback$/i,
  /^\w+@mapCallback$/i,
  /^_runner\d*$/,
  /^_run\d*$/,
  /^_callee\d*$/,
  /^_asyncToGenerator\$/,
  /^_ref\d*$/,
  /^_method\w*$/i,
  /^_\w+\$\d*$/,
  /^_interopRequireDefault$/,
  /^_slicedToArray$/,
  /^_toConsumableArray$/,
  /^_objectSpread$/,
  /^_defineProperty$/,
  /^_classCallCheck$/,
  /^_createClass$/,
  /^_possibleConstructorReturn$/,
  /^_getPrototypeOf$/,
  /^_inherits$/,
  /^_typeof$/,
];

function isCallbackishFunctionName(name) {
  if (!name) return true;
  return CALLBACKISH_FUNCTION_NAME_PATTERNS.some((re) => re.test(String(name)));
}

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function safeParseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  if (!text) return [];
  return text
    .split('\n')
    .filter(Boolean)
    .map(safeParseJsonLine)
    .filter(Boolean);
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].toSorted((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

function buildSlowFunctionStats(entries) {
  const fnMap = new Map();
  for (const entry of entries) {
    const key = `${entry.file}:${entry.line || 0}#${entry.name}`;
    const existing = fnMap.get(key) || {
      key,
      name: entry.name,
      file: entry.file,
      line: entry.line || 0,
      module: entry.module || 'unknown',
      page: entry.page || 'unknown',
      route: entry.route || 'unknown',
      count: 0,
      total: 0,
      max: 0,
      durations: [],
    };
    existing.count += 1;
    existing.total += entry.duration;
    existing.max = Math.max(existing.max, entry.duration);
    existing.durations.push(entry.duration);
    fnMap.set(key, existing);
  }

  return Array.from(fnMap.values())
    .map((f) => ({
      key: f.key,
      name: f.name,
      file: f.file,
      line: f.line || 0,
      module: f.module,
      page: f.page,
      route: f.route,
      count: f.count,
      total: f.total,
      max: f.max,
      avg: f.total / f.count,
      p95: percentile(f.durations, 95),
    }))
    .toSorted((a, b) => b.p95 - a.p95 || b.max - a.max || b.total - a.total);
}

function buildRepeatedCalls(entries, { windowMs = 100 } = {}) {
  const usable = entries
    .filter((e) => Number.isFinite(e.duration) && e.duration > 0)
    .map((e) => ({
      key: `${e.file}:${e.line || 0}#${e.name}`,
      name: e.name,
      file: e.file,
      line: e.line || 0,
      module: e.module || 'unknown',
      duration: e.duration,
      ts: Number.isFinite(e.ts) ? e.ts : 0,
    }))
    .toSorted((a, b) => a.ts - b.ts);

  const repeatMap = new Map();
  let prev = null;
  for (const entry of usable) {
    if (
      prev &&
      prev.key === entry.key &&
      Math.abs(entry.ts - prev.ts) < windowMs
    ) {
      const existing = repeatMap.get(entry.key) || {
        key: entry.key,
        name: entry.name,
        file: entry.file,
        line: entry.line || 0,
        module: entry.module,
        count: 0,
        calls: 0,
        totalDuration: 0,
        firstTs: prev.ts,
        lastTs: entry.ts,
      };
      existing.count += 1;
      existing.calls = existing.count + 1;
      existing.totalDuration += entry.duration;
      existing.lastTs = entry.ts;
      repeatMap.set(entry.key, existing);
    }
    prev = entry;
  }

  return Array.from(repeatMap.values()).toSorted(
    (a, b) => b.count - a.count || b.totalDuration - a.totalDuration,
  );
}

function buildRepeatedCallsOverall(slowFunctions) {
  const list = (slowFunctions || [])
    .filter((f) => Number.isFinite(f.count) && f.count > 0)
    .map((f) => ({
      key: f.key,
      name: f.name,
      file: f.file,
      line: f.line || 0,
      module: f.module || 'unknown',
      calls: f.count,
      totalDuration: f.total || 0,
      maxDuration: f.max || 0,
      avgDuration: f.avg || 0,
      p95Duration: f.p95 || 0,
    }))
    .toSorted(
      (a, b) =>
        b.calls - a.calls ||
        b.totalDuration - a.totalDuration ||
        b.maxDuration - a.maxDuration,
    );

  return list;
}

function getSessionCacheKey(
  sessionId,
  { outputDir = storage.OUTPUT_DIR } = {},
) {
  const sessionDir = path.join(outputDir, sessionId);
  const logPath = path.join(sessionDir, 'function_call.log');
  if (!fs.existsSync(sessionDir)) return null;
  if (!fs.existsSync(logPath)) return `${sessionId}:none`;
  const stat = fs.statSync(logPath);
  return `${sessionId}:${stat.mtimeMs}:${stat.size}`;
}

function computeSessionDerived(
  sessionId,
  { outputDir = storage.OUTPUT_DIR } = {},
) {
  const sessionDir = path.join(outputDir, sessionId);
  if (!fs.existsSync(sessionDir)) return null;

  const meta = safeReadJson(path.join(sessionDir, 'meta.json'));
  const rawEvents = readJsonl(path.join(sessionDir, 'function_call.log'));

  const entries = rawEvents
    .map(analyzer.normalizeEntry)
    .filter(Boolean)
    .filter((e) => !isCallbackishFunctionName(e.name));

  let minTs = Infinity;
  let maxTs = 0;
  for (const e of entries) {
    if (Number.isFinite(e.ts)) {
      minTs = Math.min(minTs, e.ts);
      maxTs = Math.max(maxTs, e.ts + (e.duration || 0));
    }
  }

  const modules = Array.from(
    new Set(entries.map((e) => e.module || 'unknown')),
  );
  const analysis = analyzer.analyzeEntries(entries);
  const slowFunctions = buildSlowFunctionStats(entries);
  const repeatedCalls = buildRepeatedCalls(entries, { windowMs: 100 });
  const repeatedCallsOverall = buildRepeatedCallsOverall(slowFunctions);

  return {
    sessionId,
    meta,
    entries,
    modules,
    timeRange: {
      start: minTs === Infinity ? 0 : minTs,
      end: maxTs,
      span: maxTs - (minTs === Infinity ? 0 : minTs),
    },
    analysis,
    slowFunctions,
    repeatedCalls,
    repeatedCallsOverall,
  };
}

function pickPayload(event) {
  if (!event || typeof event !== 'object') {
    return null;
  }
  if (event.data && typeof event.data === 'object') {
    return event.data;
  }
  return event;
}

function pickAbsoluteTime(event) {
  const payload = pickPayload(event);
  const candidate = payload?.absoluteTime ?? event?.absoluteTime;
  const num = Number(candidate);
  return Number.isFinite(num) ? num : 0;
}

function pickFpsValue(event) {
  const payload = pickPayload(event);
  const fps = Number(payload?.fps ?? event?.fps);
  return Number.isFinite(fps) ? fps : null;
}

function pickMarkName(event) {
  const payload = pickPayload(event);
  const name = payload?.name ?? event?.name;
  return typeof name === 'string' ? name : null;
}

function pickMarkDetail(event) {
  const payload = pickPayload(event);
  return payload?.detail ?? event?.detail ?? null;
}

function buildLowFpsWindows(
  samples,
  { thresholdFps = 10, maxGapMs = 1500 } = {},
) {
  const sorted = [...samples]
    .filter((s) => Number.isFinite(s.t) && s.t > 0 && Number.isFinite(s.fps))
    .toSorted((a, b) => a.t - b.t);
  if (!sorted.length) return [];

  const gaps = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const d = sorted[i].t - sorted[i - 1].t;
    if (Number.isFinite(d) && d > 0 && d < 10_000) gaps.push(d);
  }
  gaps.sort((a, b) => a - b);
  const typicalStep = gaps.length ? gaps[Math.floor(gaps.length * 0.5)] : 250;

  const windows = [];
  let current = null;
  for (let i = 0; i < sorted.length; i += 1) {
    const s = sorted[i];
    const isLow = s.fps >= 0 && s.fps < thresholdFps;
    if (!isLow) {
      if (current) {
        current.end = current.lastT + typicalStep;
        windows.push(current);
        current = null;
      }
    } else if (!current) {
      current = {
        start: s.t,
        end: s.t,
        lastT: s.t,
        samples: 1,
        fpsMin: s.fps,
        fpsMax: s.fps,
        fpsSum: s.fps,
      };
    } else {
      const gap = s.t - current.lastT;
      if (gap > maxGapMs) {
        current.end = current.lastT + typicalStep;
        windows.push(current);
        current = {
          start: s.t,
          end: s.t,
          lastT: s.t,
          samples: 1,
          fpsMin: s.fps,
          fpsMax: s.fps,
          fpsSum: s.fps,
        };
      } else {
        current.lastT = s.t;
        current.samples += 1;
        current.fpsMin = Math.min(current.fpsMin, s.fps);
        current.fpsMax = Math.max(current.fpsMax, s.fps);
        current.fpsSum += s.fps;
      }
    }
  }
  if (current) {
    current.end = current.lastT + typicalStep;
    windows.push(current);
  }

  return windows
    .map((w) => ({
      start: w.start,
      end: Math.max(w.end, w.start),
      span: Math.max(w.end - w.start, 0),
      samples: w.samples,
      fpsMin: w.fpsMin,
      fpsMax: w.fpsMax,
      fpsAvg: w.samples ? w.fpsSum / w.samples : 0,
    }))
    .toSorted((a, b) => b.span - a.span || a.start - b.start);
}

function summarizeEntries(entries) {
  const fnMap = new Map();
  for (const entry of entries) {
    const key = `${entry.file}:${entry.line || 0}#${entry.name}`;
    const existing = fnMap.get(key) || {
      key,
      name: entry.name,
      file: entry.file,
      line: entry.line || 0,
      module: entry.module || 'unknown',
      count: 0,
      total: 0,
      max: 0,
      durations: [],
    };
    existing.count += 1;
    existing.total += entry.duration;
    existing.max = Math.max(existing.max, entry.duration);
    existing.durations.push(entry.duration);
    fnMap.set(key, existing);
  }

  return Array.from(fnMap.values())
    .map((f) => ({
      key: f.key,
      name: f.name,
      file: f.file,
      line: f.line || 0,
      module: f.module,
      count: f.count,
      total: f.total,
      max: f.max,
      avg: f.total / f.count,
      p95: percentile(f.durations, 95),
    }))
    .toSorted(
      (a, b) => b.total - a.total || b.count - a.count || b.max - a.max,
    );
}

function computeSessionLowFpsHotspots(
  sessionId,
  {
    outputDir = storage.OUTPUT_DIR,
    thresholdFps = 10,
    topWindows = 5,
    topFunctions = 10,
  } = {},
) {
  const sessionDir = path.join(outputDir, sessionId);
  if (!fs.existsSync(sessionDir)) return null;

  const fpsEvents = readJsonl(path.join(sessionDir, 'fps.log'));
  const fpsSamples = fpsEvents
    .map((e) => ({ t: pickAbsoluteTime(e), fps: pickFpsValue(e) }))
    .filter((s) => Number.isFinite(s.t) && s.t > 0 && Number.isFinite(s.fps));

  const markEvents = readJsonl(path.join(sessionDir, 'mark.log'));
  const marks = markEvents
    .map((e) => ({
      t: pickAbsoluteTime(e),
      name: pickMarkName(e),
      detail: pickMarkDetail(e),
    }))
    .filter(
      (m) => Number.isFinite(m.t) && m.t > 0 && typeof m.name === 'string',
    );

  const windows = buildLowFpsWindows(fpsSamples, {
    thresholdFps,
    maxGapMs: 1500,
  }).slice(0, topWindows);
  if (!windows.length) {
    return {
      thresholdFps,
      topWindows: [],
    };
  }

  const derived = computeSessionDerived(sessionId, { outputDir });
  if (!derived) return null;

  const usableEntries = (derived.entries || []).filter(
    (e) =>
      Number.isFinite(e.absoluteTime) &&
      e.absoluteTime > 0 &&
      Number.isFinite(e.duration) &&
      e.duration > 0,
  );

  const windowResults = windows.map((w) => {
    const overlaps = usableEntries.filter((e) => {
      const end = e.absoluteTime;
      const start = end - e.duration;
      return start < w.end && end > w.start;
    });

    const windowMarks = marks.filter((m) => {
      const end = m.t;
      const duration = Number(m.detail?.duration ?? 0) || 0;
      const start = duration > 0 ? end - duration : end;
      return start < w.end && end > w.start;
    });
    const bgcallMarks = windowMarks
      .filter((m) => typeof m.name === 'string' && m.name.startsWith('bgcall:'))
      .map((m) => ({
        t: m.t,
        name: m.name,
        duration: Number(m.detail?.duration ?? 0) || 0,
        detail: m.detail ?? null,
      }))
      .toSorted((a, b) => b.duration - a.duration);

    const jsblockMarks = windowMarks
      .filter(
        (m) => typeof m.name === 'string' && m.name.startsWith('jsblock:'),
      )
      .map((m) => ({
        t: m.t,
        name: m.name,
        duration: Number(m.detail?.duration ?? 0) || 0,
        detail: m.detail ?? null,
      }))
      .toSorted((a, b) => b.duration - a.duration);

    const storageMarks = windowMarks
      .filter(
        (m) => typeof m.name === 'string' && m.name.startsWith('storage:'),
      )
      .map((m) => ({
        t: m.t,
        name: m.name,
        duration: Number(m.detail?.duration ?? 0) || 0,
        detail: m.detail ?? null,
      }))
      .toSorted((a, b) => b.duration - a.duration);

    const simpledbMarks = windowMarks
      .filter(
        (m) => typeof m.name === 'string' && m.name.startsWith('simpledb:'),
      )
      .map((m) => ({
        t: m.t,
        name: m.name,
        duration: Number(m.detail?.duration ?? 0) || 0,
        detail: m.detail ?? null,
      }))
      .toSorted((a, b) => b.duration - a.duration);

    const storageKeysTop = (() => {
      if (!storageMarks.length) return [];
      const map = new Map();
      for (const m of storageMarks) {
        const key =
          typeof m.detail?.key === 'string' ? m.detail.key : 'unknown';
        const existing = map.get(key) || { key, count: 0, total: 0, max: 0 };
        existing.count += 1;
        existing.total += m.duration || 0;
        existing.max = Math.max(existing.max, m.duration || 0);
        map.set(key, existing);
      }
      return Array.from(map.values())
        .map((x) => ({ ...x, avg: x.count ? x.total / x.count : 0 }))
        .toSorted(
          (a, b) => b.total - a.total || b.max - a.max || b.count - a.count,
        )
        .slice(0, 10);
    })();

    const simpledbEntitiesTop = (() => {
      if (!simpledbMarks.length) return [];
      const map = new Map();
      for (const m of simpledbMarks) {
        const entity =
          typeof m.detail?.entity === 'string' ? m.detail.entity : 'unknown';
        const existing = map.get(entity) || {
          entity,
          count: 0,
          total: 0,
          max: 0,
        };
        existing.count += 1;
        existing.total += m.duration || 0;
        existing.max = Math.max(existing.max, m.duration || 0);
        map.set(entity, existing);
      }
      return Array.from(map.values())
        .map((x) => ({ ...x, avg: x.count ? x.total / x.count : 0 }))
        .toSorted(
          (a, b) => b.total - a.total || b.max - a.max || b.count - a.count,
        )
        .slice(0, 10);
    })();

    return {
      start: w.start,
      end: w.end,
      span: w.span,
      fps: {
        samples: w.samples,
        min: w.fpsMin,
        max: w.fpsMax,
        avg: w.fpsAvg,
      },
      totals: {
        functionCalls: overlaps.length,
        functionTotalDuration: overlaps.reduce(
          (sum, e) => sum + (e.duration || 0),
          0,
        ),
      },
      bgcallMarksTop: bgcallMarks.slice(0, 10),
      jsblockMarksTop: jsblockMarks.slice(0, 10),
      storageMarksTop: storageMarks.slice(0, 10),
      simpledbMarksTop: simpledbMarks.slice(0, 10),
      storageKeysTop,
      simpledbEntitiesTop,
      topFunctions: summarizeEntries(overlaps).slice(0, topFunctions),
    };
  });

  return {
    thresholdFps,
    topWindows: windowResults,
  };
}

function computeSessionJsBlockHotspots(
  sessionId,
  {
    outputDir = storage.OUTPUT_DIR,
    topWindows = 5,
    topFunctions = 10,
    minDriftMs = 200,
  } = {},
) {
  const sessionDir = path.join(outputDir, sessionId);
  if (!fs.existsSync(sessionDir)) return null;

  const markEvents = readJsonl(path.join(sessionDir, 'mark.log'));
  const marks = markEvents
    .map((e) => ({
      t: pickAbsoluteTime(e),
      name: pickMarkName(e),
      detail: pickMarkDetail(e),
    }))
    .filter(
      (m) => Number.isFinite(m.t) && m.t > 0 && typeof m.name === 'string',
    );

  const jsblockMarks = marks
    .filter((m) => m.name && m.name.startsWith('jsblock:'))
    .map((m) => ({
      t: m.t,
      name: m.name,
      duration: Number(m.detail?.duration ?? m.detail?.drift ?? 0) || 0,
      detail: m.detail ?? null,
    }))
    .filter((m) => Number.isFinite(m.duration) && m.duration >= minDriftMs)
    .toSorted((a, b) => b.duration - a.duration || b.t - a.t)
    .slice(0, topWindows);

  if (!jsblockMarks.length) {
    return {
      minDriftMs,
      topWindows: [],
    };
  }

  const derived = computeSessionDerived(sessionId, { outputDir });
  if (!derived) return null;

  const usableEntries = (derived.entries || []).filter(
    (e) =>
      Number.isFinite(e.absoluteTime) &&
      e.absoluteTime > 0 &&
      Number.isFinite(e.duration) &&
      e.duration > 0,
  );

  const windows = jsblockMarks.map((m) => ({
    start: m.t - m.duration,
    end: m.t,
    span: m.duration,
    jsblock: m,
  }));

  const windowResults = windows.map((w) => {
    const overlaps = usableEntries.filter((e) => {
      const end = e.absoluteTime;
      const start = end - e.duration;
      return start < w.end && end > w.start;
    });

    const windowMarks = marks.filter((m) => {
      const end = m.t;
      const duration = Number(m.detail?.duration ?? 0) || 0;
      const start = duration > 0 ? end - duration : end;
      return start < w.end && end > w.start;
    });

    const bgcallMarks = windowMarks
      .filter((m) => typeof m.name === 'string' && m.name.startsWith('bgcall:'))
      .map((m) => ({
        t: m.t,
        name: m.name,
        duration: Number(m.detail?.duration ?? 0) || 0,
        detail: m.detail ?? null,
      }))
      .toSorted((a, b) => b.duration - a.duration);

    const storageMarks = windowMarks
      .filter(
        (m) => typeof m.name === 'string' && m.name.startsWith('storage:'),
      )
      .map((m) => ({
        t: m.t,
        name: m.name,
        duration: Number(m.detail?.duration ?? 0) || 0,
        detail: m.detail ?? null,
      }))
      .toSorted((a, b) => b.duration - a.duration);

    const simpledbMarks = windowMarks
      .filter(
        (m) => typeof m.name === 'string' && m.name.startsWith('simpledb:'),
      )
      .map((m) => ({
        t: m.t,
        name: m.name,
        duration: Number(m.detail?.duration ?? 0) || 0,
        detail: m.detail ?? null,
      }))
      .toSorted((a, b) => b.duration - a.duration);

    const storageKeysTop = (() => {
      if (!storageMarks.length) return [];
      const map = new Map();
      for (const m of storageMarks) {
        const key =
          typeof m.detail?.key === 'string' ? m.detail.key : 'unknown';
        const existing = map.get(key) || { key, count: 0, total: 0, max: 0 };
        existing.count += 1;
        existing.total += m.duration || 0;
        existing.max = Math.max(existing.max, m.duration || 0);
        map.set(key, existing);
      }
      return Array.from(map.values())
        .map((x) => ({ ...x, avg: x.count ? x.total / x.count : 0 }))
        .toSorted(
          (a, b) => b.total - a.total || b.max - a.max || b.count - a.count,
        )
        .slice(0, 10);
    })();

    const simpledbEntitiesTop = (() => {
      if (!simpledbMarks.length) return [];
      const map = new Map();
      for (const m of simpledbMarks) {
        const entity =
          typeof m.detail?.entity === 'string' ? m.detail.entity : 'unknown';
        const existing = map.get(entity) || {
          entity,
          count: 0,
          total: 0,
          max: 0,
        };
        existing.count += 1;
        existing.total += m.duration || 0;
        existing.max = Math.max(existing.max, m.duration || 0);
        map.set(entity, existing);
      }
      return Array.from(map.values())
        .map((x) => ({ ...x, avg: x.count ? x.total / x.count : 0 }))
        .toSorted(
          (a, b) => b.total - a.total || b.max - a.max || b.count - a.count,
        )
        .slice(0, 10);
    })();

    return {
      start: w.start,
      end: w.end,
      span: w.span,
      jsblock: w.jsblock,
      totals: {
        functionCalls: overlaps.length,
        functionTotalDuration: overlaps.reduce(
          (sum, e) => sum + (e.duration || 0),
          0,
        ),
      },
      bgcallMarksTop: bgcallMarks.slice(0, 10),
      storageMarksTop: storageMarks.slice(0, 10),
      simpledbMarksTop: simpledbMarks.slice(0, 10),
      storageKeysTop,
      simpledbEntitiesTop,
      topFunctions: summarizeEntries(overlaps).slice(0, topFunctions),
    };
  });

  return {
    minDriftMs,
    topWindows: windowResults,
  };
}

function computeSessionKeyMarks(
  sessionId,
  { outputDir = storage.OUTPUT_DIR, names = ['Home:done:tokens'] } = {},
) {
  const sessionDir = path.join(outputDir, sessionId);
  if (!fs.existsSync(sessionDir)) return null;

  const meta = safeReadJson(path.join(sessionDir, 'meta.json'));

  const markEvents = readJsonl(path.join(sessionDir, 'mark.log'));
  const marks = markEvents
    .map((e) => ({
      t: pickAbsoluteTime(e),
      name: pickMarkName(e),
      detail: pickMarkDetail(e),
    }))
    .filter(
      (m) => Number.isFinite(m.t) && m.t > 0 && typeof m.name === 'string',
    )
    .toSorted((a, b) => a.t - b.t);

  const appStartMark = marks.find((m) => m.name === 'app:start');
  const appStartTime = appStartMark ? appStartMark.t : null;
  const metaStartTime = Number(meta?.startTime);
  const sessionStart =
    appStartTime ?? (Number.isFinite(metaStartTime) ? metaStartTime : null);

  const result = {};
  for (const name of names) {
    const occurrences = marks
      .filter((m) => m.name === name)
      .map((m) => ({
        t: m.t,
        sinceSessionStartMs:
          sessionStart !== null && sessionStart !== undefined
            ? m.t - sessionStart
            : null,
        detail: m.detail ?? null,
      }));
    if (occurrences.length) {
      result[name] = {
        first: occurrences[0],
        last: occurrences[occurrences.length - 1],
        count: occurrences.length,
        occurrences,
      };

      // Convenience grouping for marks that include `detail.caller` (e.g. AllNet phases).
      // This keeps the original mark name untouched while also exposing per-caller splits
      // like `AllNet:getAllNetworkAccounts:done(tokens)`.
      const callers = Array.from(
        new Set(
          occurrences
            .map((o) =>
              typeof o.detail?.caller === 'string' ? o.detail.caller : null,
            )
            .filter(Boolean),
        ),
      );
      for (const caller of callers) {
        const byCaller = occurrences.filter((o) => o.detail?.caller === caller);
        const key = `${name}(${caller})`;
        if (byCaller.length && !result[key]) {
          result[key] = {
            first: byCaller[0],
            last: byCaller[byCaller.length - 1],
            count: byCaller.length,
            occurrences: byCaller,
          };
        }
      }
    }
  }

  return {
    sessionStart,
    marks: result,
  };
}

function computeSessionSpanHotspots(
  sessionId,
  { outputDir = storage.OUTPUT_DIR, start, end, topFunctions = 25 } = {},
) {
  const startTs = Number(start);
  const endTs = Number(end);
  if (
    !Number.isFinite(startTs) ||
    !Number.isFinite(endTs) ||
    endTs <= startTs
  ) {
    return null;
  }

  const sessionDir = path.join(outputDir, sessionId);
  if (!fs.existsSync(sessionDir)) return null;

  const markEvents = readJsonl(path.join(sessionDir, 'mark.log'));
  const marks = markEvents
    .map((e) => ({
      t: pickAbsoluteTime(e),
      name: pickMarkName(e),
      detail: pickMarkDetail(e),
    }))
    .filter(
      (m) => Number.isFinite(m.t) && m.t > 0 && typeof m.name === 'string',
    );

  const derived = computeSessionDerived(sessionId, { outputDir });
  if (!derived) return null;

  const usableEntries = (derived.entries || []).filter(
    (e) =>
      Number.isFinite(e.absoluteTime) &&
      e.absoluteTime > 0 &&
      Number.isFinite(e.duration) &&
      e.duration > 0,
  );

  const overlaps = usableEntries.filter((e) => {
    const spanEnd = e.absoluteTime;
    const spanStart = spanEnd - e.duration;
    return spanStart < endTs && spanEnd > startTs;
  });

  const windowMarks = marks.filter((m) => {
    const spanEnd = m.t;
    const duration = Number(m.detail?.duration ?? 0) || 0;
    const spanStart = duration > 0 ? spanEnd - duration : spanEnd;
    return spanStart < endTs && spanEnd > startTs;
  });

  const buildSortedMarks = (prefix) =>
    windowMarks
      .filter((m) => typeof m.name === 'string' && m.name.startsWith(prefix))
      .map((m) => ({
        t: m.t,
        name: m.name,
        duration: Number(m.detail?.duration ?? 0) || 0,
        detail: m.detail ?? null,
      }))
      .sort((a, b) => b.duration - a.duration);

  const bgcallMarks = buildSortedMarks('bgcall:');
  const jsblockMarks = buildSortedMarks('jsblock:');
  const storageMarks = buildSortedMarks('storage:');
  const simpledbMarks = buildSortedMarks('simpledb:');

  const storageKeysTop = (() => {
    if (!storageMarks.length) return [];
    const map = new Map();
    for (const m of storageMarks) {
      const key = typeof m.detail?.key === 'string' ? m.detail.key : 'unknown';
      const existing = map.get(key) || { key, count: 0, total: 0, max: 0 };
      existing.count += 1;
      existing.total += m.duration || 0;
      existing.max = Math.max(existing.max, m.duration || 0);
      map.set(key, existing);
    }
    return Array.from(map.values())
      .map((x) => ({ ...x, avg: x.count ? x.total / x.count : 0 }))
      .toSorted(
        (a, b) => b.total - a.total || b.max - a.max || b.count - a.count,
      )
      .slice(0, 10);
  })();

  const simpledbEntitiesTop = (() => {
    if (!simpledbMarks.length) return [];
    const map = new Map();
    for (const m of simpledbMarks) {
      const entity =
        typeof m.detail?.entity === 'string' ? m.detail.entity : 'unknown';
      const existing = map.get(entity) || {
        entity,
        count: 0,
        total: 0,
        max: 0,
      };
      existing.count += 1;
      existing.total += m.duration || 0;
      existing.max = Math.max(existing.max, m.duration || 0);
      map.set(entity, existing);
    }
    return Array.from(map.values())
      .map((x) => ({ ...x, avg: x.count ? x.total / x.count : 0 }))
      .toSorted(
        (a, b) => b.total - a.total || b.max - a.max || b.count - a.count,
      )
      .slice(0, 10);
  })();

  return {
    start: startTs,
    end: endTs,
    span: endTs - startTs,
    totals: {
      functionCalls: overlaps.length,
      functionTotalDuration: overlaps.reduce(
        (sum, e) => sum + (e.duration || 0),
        0,
      ),
      marks: windowMarks.length,
    },
    bgcallMarksTop: bgcallMarks.slice(0, 10),
    jsblockMarksTop: jsblockMarks.slice(0, 10),
    storageMarksTop: storageMarks.slice(0, 10),
    simpledbMarksTop: simpledbMarks.slice(0, 10),
    storageKeysTop,
    simpledbEntitiesTop,
    topFunctions: summarizeEntries(overlaps).slice(0, topFunctions),
  };
}

module.exports = {
  computeSessionDerived,
  computeSessionLowFpsHotspots,
  computeSessionJsBlockHotspots,
  computeSessionKeyMarks,
  computeSessionSpanHotspots,
  getSessionCacheKey,
};
