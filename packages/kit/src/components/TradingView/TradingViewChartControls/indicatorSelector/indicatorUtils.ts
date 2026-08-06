import type { ITradingViewIndicatorOption } from '../types';

const MAIN_CHART_INDICATOR_LABEL_SET = new Set(['MA', 'EMA', 'BOLL', 'SAR']);

export function getIndicatorSections(
  indicators: ITradingViewIndicatorOption[],
) {
  const mainIndicators: ITradingViewIndicatorOption[] = [];
  const subIndicators: ITradingViewIndicatorOption[] = [];

  indicators.forEach((indicator) => {
    if (MAIN_CHART_INDICATOR_LABEL_SET.has(indicator.label)) {
      mainIndicators.push(indicator);
    } else {
      subIndicators.push(indicator);
    }
  });

  return { mainIndicators, subIndicators };
}

function isSubIndicator(indicatorValue: string) {
  return !MAIN_CHART_INDICATOR_LABEL_SET.has(indicatorValue);
}

export function getTradingViewNativeSubIndicatorCount(
  activeIndicatorValues: ReadonlySet<string>,
) {
  let count = 0;
  activeIndicatorValues.forEach((indicatorValue) => {
    if (isSubIndicator(indicatorValue)) {
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
    !isSubIndicator(indicatorValue) ||
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
}): Array<[indicatorName: string, desiredActive: boolean]> {
  const removedIndicators = indicators.filter(
    (indicator) =>
      originalActiveIndicatorValues.has(indicator.value) &&
      !nextActiveIndicatorValues.has(indicator.value),
  );
  const addedIndicators = indicators.filter(
    (indicator) =>
      !originalActiveIndicatorValues.has(indicator.value) &&
      nextActiveIndicatorValues.has(indicator.value),
  );

  return [
    ...removedIndicators.map<[string, boolean]>((indicator) => [
      indicator.label,
      false,
    ]),
    ...addedIndicators.map<[string, boolean]>((indicator) => [
      indicator.label,
      true,
    ]),
  ];
}
