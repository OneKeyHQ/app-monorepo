const PERPS_COLD_START_PREFIX = '[PERPS_COLD_START]';
const PERPS_COLD_START_STORAGE_KEY = 'ONEKEY_PERPS_COLD_START_LOG';

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

function readStorageFlag() {
  try {
    const storage = (
      globalThis as {
        localStorage?: { getItem?: (key: string) => string | null };
      }
    ).localStorage;
    if (!storage) {
      return undefined;
    }
    return storage.getItem?.(PERPS_COLD_START_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function isPerpsColdStartPerfEnabled() {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  const flag = readStorageFlag();
  if (flag === '0' || flag === 'false') {
    return false;
  }
  return true;
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
  const absolute = Math.round(now);

  const payload: IPerpsColdStartPerfDetail = {
    t: absolute,
    elapsed,
  };
  if (detail) {
    Object.assign(payload, detail);
  }

  console.log(PERPS_COLD_START_PREFIX, label, payload);
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
