import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

export type ITradingViewKlineOptimizationMode = 'optimized' | 'baseline';
export type ITradingViewKlinePrefetchStatus =
  | 'not_started'
  | 'pending'
  | 'completed'
  | 'empty'
  | 'failed'
  | 'disabled';
export type ITradingViewKlineBootstrapStatus =
  | 'not_sent'
  | 'sent'
  | 'unavailable'
  | 'disabled';
export type ITradingViewKlinePerfProvider = 'onekey' | 'hyperliquid';

type ITradingViewKlinePerfStartSource = 'navigation' | 'chart';
type ITradingViewKlinePerfMark =
  | 'navigation_start'
  | 'prefetch_start'
  | 'prefetch_end'
  | 'chart_mount'
  | 'chart_ready'
  | 'bootstrap'
  | 'history_ready'
  | 'first_paint';

export interface ITradingViewKlinePerfIdentity {
  tokenAddress: string;
  networkId: string;
}

export interface ITradingViewKlinePerfSessionSnapshot {
  sessionId: number;
  mode: ITradingViewKlineOptimizationMode;
  provider: ITradingViewKlinePerfProvider;
  startSource: ITradingViewKlinePerfStartSource;
  startedAt: number;
  marks: Partial<Record<ITradingViewKlinePerfMark, number>>;
  prefetchStatus: ITradingViewKlinePrefetchStatus;
  bootstrapStatus: ITradingViewKlineBootstrapStatus;
  prefetchedCount?: number;
  firstPaint?: {
    durationMs: number;
    interval: string;
    status: 'rendered' | 'empty' | 'failed';
    source: 'bootstrap' | 'bridge';
    returnedCount: number;
  };
}

interface ITradingViewKlinePerfSession {
  identityKey: string;
  snapshot: ITradingViewKlinePerfSessionSnapshot;
  firstPaintRequestIds: Set<string>;
}

interface ITradingViewKlinePerfController {
  mode: 'auto' | ITradingViewKlineOptimizationMode;
  sessions: ITradingViewKlinePerfSessionSnapshot[];
  reset: () => void;
  clearDataCache?: () => void;
}

type ITradingViewKlinePerfGlobal = typeof globalThis & {
  __onekeyTradingViewKlinePerf?: ITradingViewKlinePerfController;
};

const MAX_SESSION_COUNT = 100;
const MAX_FIRST_PAINT_REQUEST_IDS = 100;
const SESSION_REUSE_WINDOW_MS = 60 * 1000;
const sessions: ITradingViewKlinePerfSession[] = [];
const activeSessionsByIdentity = new Map<
  string,
  ITradingViewKlinePerfSession
>();
let sessionSequence = 0;

function getNow() {
  if (typeof globalThis.performance?.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

function roundDuration(duration: number) {
  return Math.max(0, Math.round(duration));
}

function isLocalInspectionEnabled() {
  return platformEnv.isDev || platformEnv.isE2E || platformEnv.isJest;
}

function buildIdentityKey({
  tokenAddress,
  networkId,
}: ITradingViewKlinePerfIdentity) {
  const normalizedNetworkId = networkId.trim();
  const normalizedTokenAddress =
    normalizeTokenContractAddress({
      networkId: normalizedNetworkId,
      contractAddress: tokenAddress.trim(),
    }) ?? tokenAddress.trim();
  return `${normalizedNetworkId}:${normalizedTokenAddress}`;
}

function resetSessions() {
  sessions.length = 0;
  activeSessionsByIdentity.clear();
  const controller = getLocalController();
  if (controller) {
    controller.sessions.length = 0;
  }
}

function getLocalController() {
  if (!isLocalInspectionEnabled()) {
    return undefined;
  }
  const perfGlobal = globalThis as ITradingViewKlinePerfGlobal;
  if (!perfGlobal.__onekeyTradingViewKlinePerf) {
    perfGlobal.__onekeyTradingViewKlinePerf = {
      mode: 'auto',
      sessions: [],
      reset: resetSessions,
    };
  }
  return perfGlobal.__onekeyTradingViewKlinePerf;
}

function pruneSessions() {
  while (sessions.length > MAX_SESSION_COUNT) {
    const removed = sessions.shift();
    if (
      removed &&
      activeSessionsByIdentity.get(removed.identityKey) === removed
    ) {
      activeSessionsByIdentity.delete(removed.identityKey);
    }
  }
  const controller = getLocalController();
  if (controller) {
    while (controller.sessions.length > MAX_SESSION_COUNT) {
      controller.sessions.shift();
    }
  }
}

function createSession({
  identity,
  mode,
  provider,
  startSource,
  startedAt = getNow(),
}: {
  identity: ITradingViewKlinePerfIdentity;
  mode: ITradingViewKlineOptimizationMode;
  provider: ITradingViewKlinePerfProvider;
  startSource: ITradingViewKlinePerfStartSource;
  startedAt?: number;
}) {
  sessionSequence += 1;
  const identityKey = buildIdentityKey(identity);
  const initialMark =
    startSource === 'navigation' ? 'navigation_start' : 'chart_mount';
  const snapshot: ITradingViewKlinePerfSessionSnapshot = {
    sessionId: sessionSequence,
    mode,
    provider,
    startSource,
    startedAt,
    marks: { [initialMark]: 0 },
    prefetchStatus: mode === 'baseline' ? 'disabled' : 'not_started',
    bootstrapStatus: mode === 'baseline' ? 'disabled' : 'not_sent',
  };
  const session: ITradingViewKlinePerfSession = {
    identityKey,
    snapshot,
    firstPaintRequestIds: new Set<string>(),
  };
  sessions.push(session);
  activeSessionsByIdentity.set(identityKey, session);
  getLocalController()?.sessions.push(snapshot);
  pruneSessions();
  return session;
}

function findReusableSession(identity: ITradingViewKlinePerfIdentity) {
  const session = activeSessionsByIdentity.get(buildIdentityKey(identity));
  if (
    !session ||
    session.snapshot.firstPaint ||
    getNow() - session.snapshot.startedAt > SESSION_REUSE_WINDOW_MS
  ) {
    return undefined;
  }
  return session;
}

function updateSession({
  session,
  mode,
  provider,
}: {
  session: ITradingViewKlinePerfSession;
  mode?: ITradingViewKlineOptimizationMode;
  provider?: ITradingViewKlinePerfProvider;
}) {
  if (mode) {
    session.snapshot.mode = mode;
    if (mode === 'baseline') {
      session.snapshot.prefetchStatus = 'disabled';
      session.snapshot.bootstrapStatus = 'disabled';
    }
  }
  if (provider) {
    session.snapshot.provider = provider;
  }
  return session;
}

function ensureSession({
  identity,
  mode,
  provider = 'onekey',
  startSource = 'chart',
}: {
  identity: ITradingViewKlinePerfIdentity;
  mode: ITradingViewKlineOptimizationMode;
  provider?: ITradingViewKlinePerfProvider;
  startSource?: ITradingViewKlinePerfStartSource;
}) {
  const session = findReusableSession(identity);
  return session
    ? updateSession({ session, mode, provider })
    : createSession({ identity, mode, provider, startSource });
}

function markSession(
  session: ITradingViewKlinePerfSession,
  mark: ITradingViewKlinePerfMark,
) {
  session.snapshot.marks[mark] ??= roundDuration(
    getNow() - session.snapshot.startedAt,
  );
}

function getDurationBetween(
  marks: ITradingViewKlinePerfSessionSnapshot['marks'],
  from: ITradingViewKlinePerfMark,
  to: ITradingViewKlinePerfMark,
) {
  const start = marks[from];
  const end = marks[to];
  return start === undefined || end === undefined
    ? undefined
    : roundDuration(end - start);
}

export function resolveTradingViewKlineOptimizationMode({
  disabledByDevSettings,
}: {
  disabledByDevSettings: boolean;
}): ITradingViewKlineOptimizationMode {
  const override = getLocalController()?.mode;
  if (override === 'baseline' || override === 'optimized') {
    return override;
  }
  return disabledByDevSettings ? 'baseline' : 'optimized';
}

export function startTradingViewKlinePerfSession({
  identity,
  mode,
  startedAt,
}: {
  identity: ITradingViewKlinePerfIdentity;
  mode: ITradingViewKlineOptimizationMode;
  startedAt?: number;
}) {
  return createSession({
    identity,
    mode,
    provider: 'onekey',
    startSource: 'navigation',
    startedAt,
  }).snapshot.sessionId;
}

export function markTradingViewKlinePerf({
  identity,
  mode,
  provider,
  mark,
  prefetchStatus,
  bootstrapStatus,
  prefetchedCount,
}: {
  identity: ITradingViewKlinePerfIdentity;
  mode: ITradingViewKlineOptimizationMode;
  provider?: ITradingViewKlinePerfProvider;
  mark: Exclude<ITradingViewKlinePerfMark, 'first_paint'>;
  prefetchStatus?: ITradingViewKlinePrefetchStatus;
  bootstrapStatus?: ITradingViewKlineBootstrapStatus;
  prefetchedCount?: number;
}) {
  const session = ensureSession({ identity, mode, provider });
  markSession(session, mark);
  if (prefetchStatus) {
    const isTerminal =
      session.snapshot.prefetchStatus === 'completed' ||
      session.snapshot.prefetchStatus === 'empty' ||
      session.snapshot.prefetchStatus === 'failed' ||
      session.snapshot.prefetchStatus === 'disabled';
    if (prefetchStatus !== 'pending' || !isTerminal) {
      session.snapshot.prefetchStatus = prefetchStatus;
    }
  }
  if (bootstrapStatus) {
    session.snapshot.bootstrapStatus = bootstrapStatus;
  }
  if (prefetchedCount !== undefined) {
    session.snapshot.prefetchedCount = Math.max(0, Math.floor(prefetchedCount));
  }
}

export function completeTradingViewKlineFirstPaint({
  identity,
  mode,
  provider,
  requestId,
  interval,
  status,
  source,
  returnedCount,
}: {
  identity: ITradingViewKlinePerfIdentity;
  mode: ITradingViewKlineOptimizationMode;
  provider: ITradingViewKlinePerfProvider;
  requestId: string;
  interval: string;
  status: 'rendered' | 'empty' | 'failed';
  source: 'bootstrap' | 'bridge';
  returnedCount: number;
}) {
  const activeSession = activeSessionsByIdentity.get(
    buildIdentityKey(identity),
  );
  const session = activeSession?.snapshot.firstPaint
    ? activeSession
    : ensureSession({ identity, mode, provider });
  if (
    session.snapshot.firstPaint ||
    session.firstPaintRequestIds.has(requestId)
  ) {
    return;
  }
  session.firstPaintRequestIds.add(requestId);
  if (session.firstPaintRequestIds.size > MAX_FIRST_PAINT_REQUEST_IDS) {
    const oldestRequestId = session.firstPaintRequestIds.values().next().value;
    if (typeof oldestRequestId === 'string') {
      session.firstPaintRequestIds.delete(oldestRequestId);
    }
  }

  markSession(session, 'first_paint');
  const durationMs = session.snapshot.marks.first_paint ?? 0;
  const normalizedReturnedCount = Math.max(0, Math.floor(returnedCount));
  session.snapshot.firstPaint = {
    durationMs,
    interval,
    status,
    source,
    returnedCount: normalizedReturnedCount,
  };

  const marks = session.snapshot.marks;
  defaultLogger.dex.tradingView.dexTVFirstPaint({
    durationMs,
    chartReadyMs: marks.chart_ready,
    historyReadyMs: marks.history_ready,
    prefetchDurationMs: getDurationBetween(
      marks,
      'prefetch_start',
      'prefetch_end',
    ),
    prefetchLeadMs: getDurationBetween(marks, 'prefetch_start', 'chart_mount'),
    tvInterval: interval,
    status,
    source,
    returnedCount: normalizedReturnedCount,
    appPlatform: String(platformEnv.appPlatform ?? 'unknown'),
    optimizationMode: session.snapshot.mode,
    prefetchStatus: session.snapshot.prefetchStatus,
    bootstrapStatus: session.snapshot.bootstrapStatus,
    provider: session.snapshot.provider,
    startSource: session.snapshot.startSource,
  });
}

export function registerTradingViewKlineDataCacheReset(
  clearDataCache: () => void,
) {
  const controller = getLocalController();
  if (controller) {
    controller.clearDataCache = clearDataCache;
  }
}

getLocalController();
