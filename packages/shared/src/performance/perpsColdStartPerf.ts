import { isPerfMonitorEnabled } from './enabled';
import { perfMark } from './mark';

const PERPS_COLD_START_MARK_PREFIX = 'perps:cold_start:';

type IPerpsColdStartPerfDetail = Record<string, unknown>;

type IPerpsColdStartPerfGlobal = {
  __perpsColdStartPerfStart?: number;
  __perpsColdStartPerfOnceKeys?: Set<string>;
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
  return isPerfMonitorEnabled();
}

export function resetPerpsColdStartPerfSession() {
  if (!isPerpsColdStartPerfEnabled()) {
    return;
  }
  const state = getGlobalPerfState();
  state.__perpsColdStartPerfStart = getNow();
  state.__perpsColdStartPerfOnceKeys = new Set<string>();
  markPerpsColdStartPerf('session_reset');
}

export function markPerpsColdStartPerf(
  label: string,
  detail?: IPerpsColdStartPerfDetail,
) {
  if (!isPerpsColdStartPerfEnabled()) {
    return;
  }

  const now = getNow();
  const start = getSessionStart();
  const elapsed = Math.round(now - start);
  const payload: IPerpsColdStartPerfDetail = {
    elapsed,
  };
  if (detail) {
    Object.assign(payload, detail);
  }

  perfMark(`${PERPS_COLD_START_MARK_PREFIX}${label}`, payload);
}

export function markPerpsColdStartPerfOnce(
  label: string,
  detail?: IPerpsColdStartPerfDetail,
) {
  if (!isPerpsColdStartPerfEnabled()) {
    return;
  }

  const onceKeys = getOnceKeys();
  if (onceKeys.has(label)) {
    return;
  }
  onceKeys.add(label);
  markPerpsColdStartPerf(label, detail);
}
