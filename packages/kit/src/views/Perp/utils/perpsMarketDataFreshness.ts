export const PERPS_MARKET_DATA_STALE_MS = 5000;

export type IPerpsMarketDataFreshnessReason =
  | 'ready'
  | 'socket_not_open'
  | 'network_disconnected'
  | 'no_message'
  | 'stale';

export type IPerpsMarketDataFreshness = {
  isReady: boolean;
  isStale: boolean;
  reason: IPerpsMarketDataFreshnessReason;
  ageMs: number | undefined;
  lastMessageAt: number | null;
};

export function getPerpsMarketDataFreshness({
  isWebSocketConnected,
  networkConnected,
  lastMessageAt,
  nowMs = Date.now(),
  staleMs = PERPS_MARKET_DATA_STALE_MS,
}: {
  isWebSocketConnected: boolean;
  networkConnected: boolean | undefined;
  lastMessageAt: number | null | undefined;
  nowMs?: number;
  staleMs?: number;
}): IPerpsMarketDataFreshness {
  const normalizedLastMessageAt = lastMessageAt ?? null;

  if (networkConnected === false) {
    return {
      isReady: false,
      isStale: true,
      reason: 'network_disconnected',
      ageMs: normalizedLastMessageAt
        ? Math.max(0, nowMs - normalizedLastMessageAt)
        : undefined,
      lastMessageAt: normalizedLastMessageAt,
    };
  }

  if (!isWebSocketConnected) {
    return {
      isReady: false,
      isStale: true,
      reason: 'socket_not_open',
      ageMs: undefined,
      lastMessageAt: normalizedLastMessageAt,
    };
  }

  if (!normalizedLastMessageAt) {
    return {
      isReady: false,
      isStale: true,
      reason: 'no_message',
      ageMs: undefined,
      lastMessageAt: null,
    };
  }

  const ageMs = Math.max(0, nowMs - normalizedLastMessageAt);
  if (ageMs > staleMs) {
    return {
      isReady: false,
      isStale: true,
      reason: 'stale',
      ageMs,
      lastMessageAt: normalizedLastMessageAt,
    };
  }

  return {
    isReady: true,
    isStale: false,
    reason: 'ready',
    ageMs,
    lastMessageAt: normalizedLastMessageAt,
  };
}

export function shouldNotifyPerpsNetworkIssue(
  freshness: IPerpsMarketDataFreshness,
) {
  return (
    freshness.reason === 'network_disconnected' || freshness.reason === 'stale'
  );
}

export function shouldBlockPerpsTradingForMarketData(
  freshness: IPerpsMarketDataFreshness,
) {
  return !freshness.isReady;
}
