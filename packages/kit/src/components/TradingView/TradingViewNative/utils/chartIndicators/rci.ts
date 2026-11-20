// cspell:ignore RCI Spearman
import {
  buildTradingViewNativeIndicatorValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

/**
 * Rank correlation index: Spearman's rank correlation between time and value
 * over a full window, times 100. It is 100 when every bar is higher than the
 * one before and -100 when every bar is lower.
 *
 * Equal values share the average of their ranks, and the result still comes
 * from the squared rank differences. That is the indicator's definition on
 * the charts it is matched against, even though with ties it is no longer the
 * exact correlation of the ranks: a window with one repeated close reads
 * -87.58 there, where the tie-corrected correlation would be -88.15, and a
 * completely flat window reads 50.
 */
export function calculateTradingViewNativeRankCorrelationIndex(
  values: readonly (number | null | undefined)[],
  period: number,
): ITradingViewNativeIndicatorValues {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const denominator = normalizedPeriod * (normalizedPeriod ** 2 - 1);
  return buildTradingViewNativeIndicatorValues(values.length, (endIndex) => {
    if (endIndex < normalizedPeriod - 1 || denominator === 0) {
      return null;
    }
    // Offset 0 is the latest bar, so the offset plus one is the time rank.
    const windowValues: number[] = [];
    for (let offset = 0; offset < normalizedPeriod; offset += 1) {
      const value = values[endIndex - offset];
      if (!isTradingViewNativeFiniteValue(value)) {
        return null;
      }
      windowValues.push(value);
    }
    const offsetsByValue = windowValues
      .map((_, offset) => offset)
      .toSorted(
        (left, right) => (windowValues[right] ?? 0) - (windowValues[left] ?? 0),
      );
    let squaredRankDifferenceSum = 0;
    let groupStart = 0;
    while (groupStart < normalizedPeriod) {
      let groupEnd = groupStart;
      while (
        groupEnd + 1 < normalizedPeriod &&
        windowValues[offsetsByValue[groupEnd + 1] ?? 0] ===
          windowValues[offsetsByValue[groupStart] ?? 0]
      ) {
        groupEnd += 1;
      }
      const valueRank = (groupStart + groupEnd) / 2 + 1;
      for (let position = groupStart; position <= groupEnd; position += 1) {
        const timeRank = (offsetsByValue[position] ?? 0) + 1;
        squaredRankDifferenceSum += (timeRank - valueRank) ** 2;
      }
      groupStart = groupEnd + 1;
    }
    return 100 * (1 - (6 * squaredRankDifferenceSum) / denominator);
  });
}
