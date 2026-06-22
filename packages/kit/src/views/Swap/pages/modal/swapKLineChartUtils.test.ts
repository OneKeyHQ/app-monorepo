import {
  convertSwapKLineWalletChartToKLineResponse,
  getSwapKLineWalletChartDays,
} from './swapKLineChartUtils';

const ONE_DAY_SECONDS = 24 * 60 * 60;

describe('swapKLineChartUtils', () => {
  describe('getSwapKLineWalletChartDays', () => {
    it('covers historical request windows from now instead of only the span', () => {
      const nowSeconds = 1_700_000_000;

      expect(
        getSwapKLineWalletChartDays({
          timeFrom: nowSeconds - 20 * ONE_DAY_SECONDS,
          timeTo: nowSeconds - 19 * ONE_DAY_SECONDS,
          nowSeconds,
        }),
      ).toBe('30');
    });

    it('uses max for windows older than one year', () => {
      const nowSeconds = 1_700_000_000;

      expect(
        getSwapKLineWalletChartDays({
          timeFrom: nowSeconds - 400 * ONE_DAY_SECONDS,
          timeTo: nowSeconds - 399 * ONE_DAY_SECONDS,
          nowSeconds,
        }),
      ).toBe('max');
    });
  });

  describe('convertSwapKLineWalletChartToKLineResponse', () => {
    it('normalizes timestamps, filters to request window, and builds OHLC points', () => {
      const baseTime = 1_700_000_000;
      const result = convertSwapKLineWalletChartToKLineResponse({
        chartData: [
          [(baseTime - 1) * 1000, 5],
          [baseTime * 1000, 10],
          [(baseTime + 1) * 1000, 12],
          [baseTime + 2, 8],
          [(baseTime + 3) * 1000, Number.NaN],
        ],
        timeFrom: baseTime,
        timeTo: baseTime + 2,
      });

      expect(result).toEqual({
        points: [
          { o: 10, h: 10, l: 10, c: 10, v: 0, t: baseTime },
          { o: 10, h: 12, l: 10, c: 12, v: 0, t: baseTime + 1 },
          { o: 12, h: 12, l: 8, c: 8, v: 0, t: baseTime + 2 },
        ],
        total: 3,
      });
    });

    it('returns null when the wallet chart has no points inside the request window', () => {
      expect(
        convertSwapKLineWalletChartToKLineResponse({
          chartData: [[900_000, 5]],
          timeFrom: 1000,
          timeTo: 1002,
        }),
      ).toBeNull();
    });
  });
});
