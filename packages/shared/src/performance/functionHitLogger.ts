/**
 * Function Hit Logger - Unified (web/desktop/extension/RN) implementation
 *
 * Provides function performance tracking across all platforms via websocket.
 * File logging (RNFS) has been removed; stack snapshots are kept for parity.
 */

import {
  CALL_STACK_LOG_DEPTH,
  CALL_STACK_MAX_DEPTH,
  FUNCTION_SAMPLE_REQUEST_DEFAULT,
  FUNCTION_THRESHOLD_DEFAULT_MS,
  FUNCTION_THRESHOLD_REQUEST_MS,
  FUNCTION_WARN_DEFAULT_MS,
  FUNCTION_WARN_REQUEST_MS,
} from './functionHitLogger.const';

type IPerfFunctionCallEvent = {
  name: string;
  file: string;
  line?: number;
  duration: number;
  module?: string;
  stack?: string[];
  absoluteTime: number;
  timestamp: number;
};

type IPerfFunctionGlobal = {
  __profilerTraceId?: string;
  __perfReportFunctionCall?: (data: IPerfFunctionCallEvent) => void;
  __perfFunctionBuffer?: IPerfFunctionCallEvent[];

  __perfFunctionLoggerInstalled?: boolean;
  __logFunctionHit?: typeof logFunctionHit;
  __recordFunctionStart?: typeof recordFunctionPerfStart;
  __recordFunctionEnd?: typeof recordFunctionPerfEnd;
  __setProfilerTraceId?: (id: string) => string;
  __setProfilerRoute?: (route: string) => void;
  __setProfilerAction?: (action: string) => void;
};

// Thresholds (support both legacy web env vars and RN profiler env vars)
const perfThresholdMs = Number.parseInt(
  (typeof process !== 'undefined' && process.env?.RN_PROFILER_THRESHOLD_MS) ||
    (typeof process !== 'undefined' &&
      process.env?.PERF_FUNCTION_THRESHOLD_MS) ||
    `${FUNCTION_THRESHOLD_DEFAULT_MS}`,
  10,
);
const perfWarnMs = Number.parseInt(
  (typeof process !== 'undefined' && process.env?.RN_PROFILER_WARN_MS) ||
    (typeof process !== 'undefined' && process.env?.PERF_FUNCTION_WARN_MS) ||
    `${FUNCTION_WARN_DEFAULT_MS}`,
  10,
);

let globalTraceId: string =
  (typeof process !== 'undefined' && process.env?.RN_PROFILER_TRACE_ID) ||
  `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Runtime context for debugging
let currentRoute: string | undefined;
let lastUserAction: string | undefined;
let lastActionTimestamp: number | undefined;

// Global call stack tracking to build stack snapshots
const callStack: Array<{ name: string; file: string; line?: number }> = [];

function normalizePath(file?: string) {
  return file ? file.replace(/\\/g, '/') : file;
}

export function startProfilerHeartbeat(_intervalMs = 2000) {
  return null;
}

export function stopProfilerHeartbeat() {
  return null;
}

export async function logFunctionHit(_meta: {
  name: string;
  file: string;
  line?: number;
}) {
  return null;
}

function pickModule(file: string) {
  if (!file) return 'unknown';

  const normalized = normalizePath(file) || file;
  const parts = normalized.split('/').filter(Boolean);
  const packagesIdx = parts.indexOf('packages');
  if (packagesIdx < 0 || !parts[packagesIdx + 1]) return 'other';

  const pkg = parts[packagesIdx + 1];
  const srcIdx = parts.indexOf('src', packagesIdx + 2);
  if (srcIdx >= 0 && parts[srcIdx + 1]) {
    const scope = parts[srcIdx + 1];
    // If the next segment looks like a filename, keep module at package-level.
    if (scope.includes('.')) {
      return pkg;
    }
    return `${pkg}/${scope}`;
  }

  return pkg;
}

function pickPage(file: string) {
  if (!file) return undefined;
  const parts = file.split('/');
  const pagesIdx = parts.indexOf('pages');
  if (pagesIdx >= 0 && parts[pagesIdx + 1]) {
    return parts[pagesIdx + 1].replace(/\.(tsx|ts|js|jsx)$/, '');
  }
  const viewsIdx = parts.indexOf('views');
  if (viewsIdx >= 0 && parts[viewsIdx + 1]) {
    return parts[viewsIdx + 1];
  }
  return undefined;
}

function getModuleConfig(module: string) {
  if (module === 'shared/request') {
    const threshold = Number.parseInt(
      (typeof process !== 'undefined' &&
        process.env?.RN_PROFILER_THRESHOLD_REQUEST_MS) ||
        `${FUNCTION_THRESHOLD_REQUEST_MS}`,
      10,
    );
    const warn = Number.parseInt(
      (typeof process !== 'undefined' &&
        process.env?.RN_PROFILER_WARN_REQUEST_MS) ||
        `${FUNCTION_WARN_REQUEST_MS}`,
      10,
    );
    const sample = Number.parseInt(
      (typeof process !== 'undefined' &&
        process.env?.RN_PROFILER_SAMPLE_REQUEST) ||
        `${FUNCTION_SAMPLE_REQUEST_DEFAULT}`,
      10,
    );
    return { threshold, warn, sample };
  }
  return { threshold: perfThresholdMs, warn: perfWarnMs, sample: 1 };
}

export function recordFunctionPerfStart(meta: {
  name: string;
  file: string;
  line?: number;
}) {
  const normalizedFile = normalizePath(meta.file) || meta.file;
  // Push current frame to call stack (with depth limit)
  const frame = { name: meta.name, file: normalizedFile, line: meta.line };
  if (callStack.length < CALL_STACK_MAX_DEPTH) {
    callStack.push(frame);
  }

  // Capture current call stack snapshot (excluding self)
  const stackSnapshot =
    callStack.length > 1
      ? callStack
          .slice(
            Math.max(0, callStack.length - 1 - CALL_STACK_LOG_DEPTH),
            callStack.length - 1,
          )
          .filter((f) => f !== null && f !== undefined)
          .map((f) => `${f.file}:${f.line || 0}#${f.name}`)
      : undefined;

  const module = pickModule(normalizedFile);
  const page = pickPage(normalizedFile);
  const g = globalThis as unknown as IPerfFunctionGlobal;
  return {
    meta: {
      ...meta,
      file: normalizedFile,
      module,
      page,
      traceId: g.__profilerTraceId || globalTraceId,
      // Runtime context
      route: currentRoute,
      action: lastUserAction,
      actionAge:
        lastActionTimestamp !== undefined
          ? Date.now() - lastActionTimestamp
          : undefined,
    },
    start:
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now(),
    stackDepth: callStack.length, // Record stack depth for later restoration
    stackSnapshot, // Pre-captured stack for async safety
    config: getModuleConfig(module),
    startedAt: Date.now(),
  };
}

export type IFunctionPerfToken = ReturnType<typeof recordFunctionPerfStart>;

export function recordFunctionPerfEnd(token?: IFunctionPerfToken) {
  if (!token) {
    return;
  }

  // Restore call stack to state before this function was called
  if (
    token.stackDepth !== undefined &&
    token.stackDepth > 0 &&
    token.stackDepth - 1 < callStack.length
  ) {
    callStack.length = token.stackDepth - 1;
  }

  const duration =
    (typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now()) - token.start;

  const config = token.config || getModuleConfig(token.meta.module || 'other');
  if (config.sample > 1) {
    const r = Math.floor(Math.random() * config.sample);
    if (r !== 0) {
      return;
    }
  }
  if (duration < config.threshold) {
    return;
  }

  // Use pre-captured stack snapshot for async safety
  const normalizedFile = normalizePath(token.meta.file) || token.meta.file;
  const stack = token.stackSnapshot;
  const module = token.meta.module || pickModule(normalizedFile);

  // Report to performance server if available
  const g = globalThis as unknown as IPerfFunctionGlobal;
  if (typeof g.__perfReportFunctionCall === 'function') {
    const endTimestamp =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    const absoluteTime = Date.now();
    g.__perfReportFunctionCall({
      name: token.meta.name,
      file: normalizedFile,
      line: token.meta.line,
      duration,
      module,
      stack,
      // forward absoluteTime so downstream can choose start = absoluteTime - duration
      absoluteTime,
      timestamp: endTimestamp,
    });
  } else {
    // Buffer function calls if reporter not ready yet (for non-blocking mobile bootstrap)
    if (!Array.isArray(g.__perfFunctionBuffer)) {
      g.__perfFunctionBuffer = [];
    }
    // Limit buffer size to prevent memory issues
    if (g.__perfFunctionBuffer.length < 1000) {
      g.__perfFunctionBuffer.push({
        name: token.meta.name,
        file: normalizedFile,
        line: token.meta.line,
        duration,
        module,
        stack,
        absoluteTime: Date.now(),
        timestamp:
          typeof performance !== 'undefined' && performance.now
            ? performance.now()
            : Date.now(),
      });
    }
  }
}

export default {
  startProfilerHeartbeat,
  stopProfilerHeartbeat,
  logFunctionHit,
  recordFunctionPerfStart,
  recordFunctionPerfEnd,
};

export function installFunctionHitLogger(): typeof logFunctionHit {
  const g = globalThis as unknown as IPerfFunctionGlobal;
  if (g.__perfFunctionLoggerInstalled) {
    return g.__logFunctionHit ?? logFunctionHit;
  }
  g.__perfFunctionLoggerInstalled = true;
  // eslint-disable-next-line no-console
  console.log(
    `[FunctionHitLogger] Installing (threshold: ${perfThresholdMs}ms, warn: ${perfWarnMs}ms)`,
  );
  g.__logFunctionHit = logFunctionHit;
  g.__recordFunctionStart = recordFunctionPerfStart;
  g.__recordFunctionEnd = recordFunctionPerfEnd;
  g.__profilerTraceId = globalTraceId;
  g.__setProfilerTraceId = (id: string) => {
    if (id) {
      globalTraceId = id;
      g.__profilerTraceId = globalTraceId;
    }
    return globalTraceId;
  };
  g.__setProfilerRoute = (route: string) => {
    currentRoute = route;
  };
  g.__setProfilerAction = (action: string) => {
    lastUserAction = action;
    lastActionTimestamp = Date.now();
  };

  return logFunctionHit;
}
