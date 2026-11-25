import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

export const OI_WINDOW_DAYS = {
  '24h': 1,
  '7d': 7,
  history: 90,
} as const;

export type IPerpOiHistoryRange = keyof typeof OI_WINDOW_DAYS;

export function fetchPerpOiHistory(coin: string, range: IPerpOiHistoryRange) {
  const endTime = Date.now();
  return backgroundApiProxy.serviceHyperliquid.getPerpOiHistory({
    coin,
    interval: range === 'history' ? '1h' : '5m',
    startTime: endTime - OI_WINDOW_DAYS[range] * 86_400_000,
    endTime,
  });
}
