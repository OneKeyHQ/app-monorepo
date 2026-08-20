import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

export function buildTradingViewNativeIndicatorTestPoints(
  closeValues: readonly number[],
  volumeValues: readonly number[] = [],
): IMarketTokenKLineDataPoint[] {
  return closeValues.map((close, index) => ({
    c: close,
    h: close + 1,
    l: close - 1,
    o: close,
    t: 1_700_000_000 + index * 3600,
    v: volumeValues[index] ?? 10,
  }));
}

export function expectTradingViewNativeIndicatorValuesToBeCloseTo(
  actual: readonly (number | null)[],
  expected: readonly (number | null)[],
) {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((expectedValue, index) => {
    if (expectedValue === null) {
      expect(actual[index]).toBeNull();
    } else {
      expect(actual[index]).toBeCloseTo(expectedValue, 10);
    }
  });
}

export function getFirstTradingViewNativeFiniteValueIndex(
  values: readonly (number | null)[],
) {
  return values.findIndex(
    (value) => typeof value === 'number' && Number.isFinite(value),
  );
}

export function expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(
  values: ITradingViewNativeIndicatorValues,
) {
  expect(
    values.every(
      (value) =>
        value === null || (typeof value === 'number' && Number.isFinite(value)),
    ),
  ).toBe(true);
}
