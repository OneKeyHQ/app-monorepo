// cspell:ignore bollinger keltner
import {
  TRADING_VIEW_NATIVE_SQUEEZE_NONE,
  TRADING_VIEW_NATIVE_SQUEEZE_OFF,
  TRADING_VIEW_NATIVE_SQUEEZE_ON,
  calculateTradingViewNativeSqueezeMomentum,
} from './squeezeMomentum';
import {
  buildTradingViewNativeIndicatorTestPoints,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative squeeze momentum indicator', () => {
  // Closes rise by one a bar; each bar spans one above to one below its close.
  const points = buildTradingViewNativeIndicatorTestPoints(
    Array.from({ length: 12 }, (_, index) => 100 + index),
  );
  const options = { bollingerPeriod: 3, keltnerPeriod: 3, momentumPeriod: 2 };

  it('measures how far the close leads the middle of its recent range', () => {
    const { momentum } = calculateTradingViewNativeSqueezeMomentum(
      points,
      options,
    );

    // The range midpoint and the average both trail a steady rise by one.
    expect(getFirstTradingViewNativeFiniteValueIndex(momentum)).toBe(3);
    expect(momentum[11]).toBeCloseTo(1, 10);
  });

  it('reports a squeeze while the Bollinger Bands sit inside the Keltner Channel', () => {
    const { squeeze } = calculateTradingViewNativeSqueezeMomentum(points, {
      ...options,
      bollingerMultiplier: 2,
      keltnerMultiplier: 1.5,
    });

    expect(getFirstTradingViewNativeFiniteValueIndex(squeeze)).toBe(3);
    expect(squeeze[11]).toBe(TRADING_VIEW_NATIVE_SQUEEZE_ON);
  });

  it('reports a released squeeze while the Bollinger Bands sit outside', () => {
    const { squeeze } = calculateTradingViewNativeSqueezeMomentum(points, {
      ...options,
      bollingerMultiplier: 5,
      keltnerMultiplier: 1.5,
    });

    expect(squeeze[11]).toBe(TRADING_VIEW_NATIVE_SQUEEZE_OFF);
  });

  it('reports neither state when the two bands have the same width', () => {
    // Both widths are zero on bars that never move, at any price level.
    for (const price of [10, 0.1]) {
      const flatPoints = Array.from({ length: 50 }, (_, index) => ({
        c: price,
        h: price,
        l: price,
        o: price,
        t: index,
        v: 1,
      }));
      const { momentum, squeeze } =
        calculateTradingViewNativeSqueezeMomentum(flatPoints);

      expect(squeeze[49]).toBe(TRADING_VIEW_NATIVE_SQUEEZE_NONE);
      expect(momentum[49]).toBeCloseTo(0, 12);
    }
  });
});
