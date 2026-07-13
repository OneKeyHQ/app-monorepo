import { defaultLogger } from '../logger/logger';

const PERPS_COLD_START_BENCHMARK_TAG = 'PerpsColdStartBenchmark';

type IPerpsColdStartPerfDetail = Record<string, unknown>;

type IPerpsColdStartPerfGlobal = {
  __perpsColdStartPerfStart?: number;
  __perpsColdStartPerfOnceKeys?: Set<string>;
  __perpsColdStartPerfSessionId?: number;
};

function getGlobalPerfState() {
  return globalThis as IPerpsColdStartPerfGlobal;
}

function getNow() {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now();
  }
  return Date.now();
}

function getSessionStart() {
  const state = getGlobalPerfState();
  if (!state.__perpsColdStartPerfStart) {
    state.__perpsColdStartPerfStart = getNow();
  }
  return state.__perpsColdStartPerfStart;
}

function getOnceKeys() {
  const state = getGlobalPerfState();
  if (!state.__perpsColdStartPerfOnceKeys) {
    state.__perpsColdStartPerfOnceKeys = new Set<string>();
  }
  return state.__perpsColdStartPerfOnceKeys;
}

export function isPerpsColdStartPerfEnabled() {
  return true;
}

function getSessionId() {
  const state = getGlobalPerfState();
  if (!state.__perpsColdStartPerfSessionId) {
    state.__perpsColdStartPerfSessionId = 1;
  }
  return state.__perpsColdStartPerfSessionId;
}

export function resetPerpsColdStartPerfSession() {
  const state = getGlobalPerfState();
  state.__perpsColdStartPerfStart = getNow();
  state.__perpsColdStartPerfSessionId =
    (state.__perpsColdStartPerfSessionId ?? 0) + 1;
  state.__perpsColdStartPerfOnceKeys = new Set<string>();
  markPerpsColdStartPerf('session_reset');
}

export function markPerpsColdStartPerf(
  label: string,
  detail?: IPerpsColdStartPerfDetail,
) {
  const now = getNow();
  const start = getSessionStart();
  const elapsed = Math.round(now - start);
  const params: {
    tag: typeof PERPS_COLD_START_BENCHMARK_TAG;
    label: string;
    elapsed: number;
    sessionId: number;
    detail?: IPerpsColdStartPerfDetail;
  } = {
    tag: PERPS_COLD_START_BENCHMARK_TAG,
    label,
    elapsed,
    sessionId: getSessionId(),
  };
  if (detail) {
    params.detail = detail;
  }
  defaultLogger.perp.hyperliquid.coldStartBenchmark(params);
}

export function markPerpsColdStartPerfOnce(
  label: string,
  detail?: IPerpsColdStartPerfDetail,
) {
  const onceKeys = getOnceKeys();
  if (onceKeys.has(label)) {
    return;
  }
  onceKeys.add(label);
  markPerpsColdStartPerf(label, detail);
}
