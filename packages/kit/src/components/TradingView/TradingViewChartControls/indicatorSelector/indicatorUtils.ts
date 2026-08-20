import {
  isTradingViewNativeIndicator,
  isTradingViewNativeSubIndicator,
  resolveTradingViewNativeIndicatorId,
} from '../../TradingViewNative/utils/chartIndicators/indicatorCatalog';

import type { ITradingViewIndicatorOption } from '../types';

function getCanonicalIndicatorId(indicator: ITradingViewIndicatorOption) {
  return resolveTradingViewNativeIndicatorId(indicator.value, indicator.label);
}

function hasActiveIndicatorValue(
  activeIndicatorValues: ReadonlySet<string>,
  indicator: ITradingViewIndicatorOption,
  canonicalIndicatorId: string,
) {
  return (
    activeIndicatorValues.has(canonicalIndicatorId) ||
    activeIndicatorValues.has(indicator.value)
  );
}

export function getIndicatorSections(
  indicators: ITradingViewIndicatorOption[],
) {
  const mainIndicators: ITradingViewIndicatorOption[] = [];
  const subIndicators: ITradingViewIndicatorOption[] = [];

  indicators.forEach((indicator) => {
    const indicatorId = getCanonicalIndicatorId(indicator);
    if (indicatorId && isTradingViewNativeIndicator(indicatorId)) {
      mainIndicators.push(indicator);
    } else if (indicatorId && isTradingViewNativeSubIndicator(indicatorId)) {
      subIndicators.push(indicator);
    }
  });

  return { mainIndicators, subIndicators };
}

export function getTradingViewNativeSubIndicatorCount(
  activeIndicatorValues: ReadonlySet<string>,
) {
  let count = 0;
  activeIndicatorValues.forEach((indicatorValue) => {
    if (isTradingViewNativeSubIndicator(indicatorValue)) {
      count += 1;
    }
  });
  return count;
}

export function canToggleTradingViewNativeIndicatorOn({
  indicatorValue,
  activeIndicatorValues,
  maxSubIndicatorCount,
}: {
  indicatorValue: string;
  activeIndicatorValues: ReadonlySet<string>;
  maxSubIndicatorCount?: number;
}) {
  const normalizedMaxSubIndicatorCount =
    typeof maxSubIndicatorCount === 'number' &&
    Number.isFinite(maxSubIndicatorCount)
      ? Math.max(0, Math.floor(maxSubIndicatorCount))
      : undefined;

  if (
    normalizedMaxSubIndicatorCount === undefined ||
    !isTradingViewNativeSubIndicator(indicatorValue) ||
    activeIndicatorValues.has(indicatorValue)
  ) {
    return true;
  }

  return (
    getTradingViewNativeSubIndicatorCount(activeIndicatorValues) <
    normalizedMaxSubIndicatorCount
  );
}

export function getNativeIndicatorSelectionUpdates({
  indicators,
  originalActiveIndicatorValues,
  nextActiveIndicatorValues,
}: {
  indicators: ITradingViewIndicatorOption[];
  originalActiveIndicatorValues: ReadonlySet<string>;
  nextActiveIndicatorValues: ReadonlySet<string>;
}): Array<[indicatorId: string, desiredActive: boolean]> {
  const removedIndicators = indicators.flatMap<[string, boolean]>(
    (indicator) => {
      const indicatorId = getCanonicalIndicatorId(indicator);
      return indicatorId !== null &&
        hasActiveIndicatorValue(
          originalActiveIndicatorValues,
          indicator,
          indicatorId,
        ) &&
        !hasActiveIndicatorValue(
          nextActiveIndicatorValues,
          indicator,
          indicatorId,
        )
        ? [[indicatorId, false]]
        : [];
    },
  );
  const addedIndicators = indicators.flatMap<[string, boolean]>((indicator) => {
    const indicatorId = getCanonicalIndicatorId(indicator);
    return indicatorId !== null &&
      !hasActiveIndicatorValue(
        originalActiveIndicatorValues,
        indicator,
        indicatorId,
      ) &&
      hasActiveIndicatorValue(nextActiveIndicatorValues, indicator, indicatorId)
      ? [[indicatorId, true]]
      : [];
  });

  return [...removedIndicators, ...addedIndicators];
}
