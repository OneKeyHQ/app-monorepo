import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  convertCoinGeckoChartToKLineResponse,
  getCoinGeckoChartDaysForInterval,
  getCoinGeckoHistoryRequestCandleCount,
} from './coinGeckoKLineUtils';
import { getTradingViewNativeKLineInterval } from './tradingViewNativeIntervals';

function getInterval(value: string) {
  const interval = getTradingViewNativeKLineInterval(value);
  if (!interval) {
    throw new OneKeyLocalError(`Unsupported test interval: ${value}`);
  }
  return interval;
}

describe('CoinGecko TradingViewNative K-line utilities', () => {
  it('uses interval-specific lookbacks instead of the generic 2000-candle window', () => {
    expect(getCoinGeckoChartDaysForInterval(getInterval('5'))).toBe('1');
    expect(getCoinGeckoChartDaysForInterval(getInterval('15'))).toBe('1');
    expect(getCoinGeckoChartDaysForInterval(getInterval('60'))).toBe('30');
    expect(getCoinGeckoChartDaysForInterval(getInterval('1D'))).toBe('max');

    expect(getCoinGeckoHistoryRequestCandleCount(getInterval('5'))).toBe(288);
    expect(getCoinGeckoHistoryRequestCandleCount(getInterval('15'))).toBe(96);
    expect(getCoinGeckoHistoryRequestCandleCount(getInterval('60'))).toBe(720);
  });

  it('aggregates chart samples into the selected candle interval', () => {
    expect(
      convertCoinGeckoChartToKLineResponse({
        chartData: [
          [300, 10],
          [420, 12],
          [850, 8],
        ],
        intervalSeconds: 300,
        timeFrom: 0,
        timeTo: 1000,
      }),
    ).toEqual({
      points: [
        { o: 10, h: 12, l: 10, c: 12, v: 0, t: 300 },
        { o: 8, h: 8, l: 8, c: 8, v: 0, t: 600 },
      ],
      total: 2,
    });
  });

  it('returns an empty page when the requested window has no samples', () => {
    expect(
      convertCoinGeckoChartToKLineResponse({
        chartData: [[300, 10]],
        intervalSeconds: 300,
        timeFrom: 600,
        timeTo: 900,
      }),
    ).toEqual({ points: [], total: 0 });
  });
});
