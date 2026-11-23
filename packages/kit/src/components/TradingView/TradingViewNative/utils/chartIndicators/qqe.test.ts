// cspell:ignore QQE
import { calculateTradingViewNativeExponentialMovingAverage } from './ema';
import { calculateTradingViewNativeQqe } from './qqe';
import { calculateTradingViewNativeRelativeStrengthIndex } from './rsi';
import { getFirstTradingViewNativeFiniteValueIndex } from './testUtils';

describe('TradingViewNative QQE indicator', () => {
  const options = { rsiPeriod: 3, smoothingPeriod: 2 };

  it('smooths the RSI with an exponential average', () => {
    const values = Array.from(
      { length: 40 },
      (_, index) => 100 + Math.sin(index / 2) * 10,
    );

    expect(calculateTradingViewNativeQqe(values, options).rsi).toEqual(
      calculateTradingViewNativeExponentialMovingAverage(
        calculateTradingViewNativeRelativeStrengthIndex(values, { period: 3 })
          .rsi,
        2,
      ),
    );
  });

  it('starts the trailing lines once the band width has warmed up', () => {
    const values = Array.from({ length: 20 }, (_, index) => 100 + index);
    const { fast, rsi, slow } = calculateTradingViewNativeQqe(values, options);

    // RSI from bar 3, its 2-bar average from bar 4, its movement from bar 5,
    // then two 5-bar exponential averages.
    expect(getFirstTradingViewNativeFiniteValueIndex(rsi)).toBe(4);
    expect(getFirstTradingViewNativeFiniteValueIndex(fast)).toBe(13);
    expect(getFirstTradingViewNativeFiniteValueIndex(slow)).toBe(13);
    // A steady rise pins the RSI at 100, so the lines have no distance to keep.
    expect(fast[19]).toBe(100);
    expect(slow[19]).toBe(100);
  });

  it('moves a line to the other side of the RSI after the RSI crosses it', () => {
    const values = [
      ...Array.from({ length: 30 }, (_, index) => 100 + index),
      ...Array.from({ length: 30 }, (_, index) => 129 - index * 2),
    ];
    const { fast, rsi } = calculateTradingViewNativeQqe(values, options);
    const sides = fast.flatMap((value, index) => {
      const rsiValue = rsi[index];
      return value === null || rsiValue === null || rsiValue === value
        ? []
        : [Math.sign(rsiValue - value)];
    });

    // Below the RSI through the rise, above it once the fall is under way.
    expect(sides).toContain(1);
    expect(sides.at(-1)).toBe(-1);
  });
});
