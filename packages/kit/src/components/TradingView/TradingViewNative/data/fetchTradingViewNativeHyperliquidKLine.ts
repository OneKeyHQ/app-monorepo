import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';

import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import {
  getHyperliquidCandleInterval,
  normalizeHyperliquidCandle,
} from './hyperliquidCandleUtils';

const tradingViewNativeHyperliquidInfoClient = new InfoClient({
  transport: new HttpTransport(),
});

export async function fetchTradingViewNativeHyperliquidKLine({
  coin,
  interval,
  timeFrom,
  timeTo,
  signal,
}: {
  coin: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
  signal?: AbortSignal;
}): Promise<IMarketTokenKLineResponse> {
  const candles = await tradingViewNativeHyperliquidInfoClient.candleSnapshot(
    {
      coin,
      interval: getHyperliquidCandleInterval(interval),
      startTime: timeFrom * 1000,
      endTime: timeTo * 1000,
    },
    signal,
  );
  const points = candles
    .map(normalizeHyperliquidCandle)
    .filter((point) => point !== null);

  return {
    points,
    total: points.length,
  };
}
