import { calculateTradingViewNativeSuperTrend } from './superTrend';
import { buildTradingViewNativeIndicatorTestPoints } from './testUtils';

describe('TradingViewNative SuperTrend indicator', () => {
  const options = { atrPeriod: 3, multiplier: 1 };

  it('waits for the average true range and then shows exactly one band per bar', () => {
    const closes = Array.from({ length: 12 }, (_, index) => 100 + index * 5);
    const { downTrend, upTrend } = calculateTradingViewNativeSuperTrend(
      buildTradingViewNativeIndicatorTestPoints(closes),
      options,
    );

    closes.forEach((_, index) => {
      const bandCount =
        Number(downTrend[index] !== null) + Number(upTrend[index] !== null);
      expect(bandCount).toBe(index < 3 ? 0 : 1);
    });
  });

  it('follows a rise with a band below price that never moves down', () => {
    const closes = Array.from({ length: 12 }, (_, index) => 100 + index * 5);
    const { upTrend } = calculateTradingViewNativeSuperTrend(
      buildTradingViewNativeIndicatorTestPoints(closes),
      options,
    );
    const bands = upTrend.flatMap((value, index) =>
      value === null ? [] : [{ close: closes[index] ?? 0, value }],
    );

    expect(upTrend[closes.length - 1]).not.toBeNull();
    bands.forEach(({ close, value }, index) => {
      expect(value).toBeLessThan(close);
      expect(value).toBeGreaterThanOrEqual(bands[index - 1]?.value ?? value);
    });
  });

  it('follows a fall with a band above price and flips when price closes through it', () => {
    const closes = [
      ...Array.from({ length: 8 }, (_, index) => 200 - index * 5),
      230,
      235,
    ];
    const { downTrend, upTrend } = calculateTradingViewNativeSuperTrend(
      buildTradingViewNativeIndicatorTestPoints(closes),
      options,
    );

    expect(downTrend[7]).toBeGreaterThan(closes[7] ?? 0);
    expect(upTrend[7]).toBeNull();
    expect(downTrend[8]).toBeNull();
    expect(upTrend[8]).toBeLessThan(closes[8] ?? 0);
  });

  it('restarts after a bar without valid prices', () => {
    const points = buildTradingViewNativeIndicatorTestPoints(
      Array.from({ length: 10 }, (_, index) => 100 + index),
    );
    points[5] = { ...points[5], c: Number.NaN, h: Number.NaN, l: Number.NaN };
    const { downTrend, upTrend } = calculateTradingViewNativeSuperTrend(
      points,
      options,
    );

    expect(downTrend[5]).toBeNull();
    expect(upTrend[5]).toBeNull();
    expect(
      [...downTrend, ...upTrend].every(
        (value) => value === null || Number.isFinite(value),
      ),
    ).toBe(true);
  });
});
