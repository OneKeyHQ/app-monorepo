import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ITradingViewIndicatorOption,
  ITradingViewNativeChartControlsConfigData,
} from '../../../types';

const APP_NATIVE_INDICATOR_OPTIONS: ITradingViewIndicatorOption[] = [
  { label: 'MA', value: 'MA' },
  { label: 'EMA', value: 'EMA' },
  { label: 'BOLL', value: 'BOLL' },
  { label: 'SAR', value: 'SAR' },
  { label: 'VOL', value: 'VOL' },
  { label: 'MACD', value: 'MACD' },
  { label: 'RSI', value: 'RSI' },
  { label: 'StochRSI', value: 'StochRSI' },
  { label: 'OBV', value: 'OBV' },
  { label: 'MFI', value: 'MFI' },
  { label: 'TRIX', value: 'TRIX' },
  { label: 'EMV', value: 'EMV' },
  { label: 'WR', value: 'WR' },
  { label: 'ROC', value: 'ROC' },
  { label: 'MTM', value: 'MTM' },
  { label: 'DMI', value: 'DMI' },
  { label: 'CCI', value: 'CCI' },
];
const APP_NATIVE_INDICATOR_VALUE_SET = new Set(
  APP_NATIVE_INDICATOR_OPTIONS.map((indicator) => indicator.value),
);
const MAIN_CHART_INDICATOR_LABEL_SET = new Set<string>([
  'MA',
  'EMA',
  'BOLL',
  'SAR',
]);

export interface ITradingViewNativeIndicatorState {
  activeIndicatorValues: Set<string>;
  isInitialized: boolean;
  getActiveIndicatorValues: () => ReadonlySet<string>;
  updateActiveIndicatorValue: (
    indicatorValue: string,
    desiredActive: boolean,
  ) => void;
}

function getAppNativeIndicatorValue(indicator: ITradingViewIndicatorOption) {
  if (APP_NATIVE_INDICATOR_VALUE_SET.has(indicator.label)) {
    return indicator.label;
  }

  if (APP_NATIVE_INDICATOR_VALUE_SET.has(indicator.value)) {
    return indicator.value;
  }

  return null;
}

function getActiveIndicatorValueSet(
  indicators: ITradingViewIndicatorOption[] | undefined,
) {
  const activeValues = new Set<string>();
  indicators?.forEach((indicator) => {
    if (!indicator.active) {
      return;
    }

    const indicatorValue = getAppNativeIndicatorValue(indicator);
    if (indicatorValue) {
      activeValues.add(indicatorValue);
    }
  });
  return activeValues;
}

export function getAppNativeIndicators(activeIndicatorValues: Set<string>) {
  return APP_NATIVE_INDICATOR_OPTIONS.map((indicator) => ({
    ...indicator,
    active: activeIndicatorValues.has(indicator.value),
  }));
}

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

  return {
    mainIndicators,
    subIndicators,
  };
}

function isTradingViewNativeSubIndicator(indicatorValue: string) {
  return !MAIN_CHART_INDICATOR_LABEL_SET.has(indicatorValue);
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

export function getTradingViewNativeSubIndicatorCountFromOptions(
  indicators: ITradingViewIndicatorOption[] | undefined,
) {
  return getTradingViewNativeSubIndicatorCount(
    getActiveIndicatorValueSet(indicators),
  );
}

function normalizeTradingViewNativeMaxSubIndicatorCount(
  maxSubIndicatorCount: number | undefined,
) {
  return typeof maxSubIndicatorCount === 'number' &&
    Number.isFinite(maxSubIndicatorCount)
    ? Math.max(0, Math.floor(maxSubIndicatorCount))
    : undefined;
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
    normalizeTradingViewNativeMaxSubIndicatorCount(maxSubIndicatorCount);

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

export function useNativeIndicatorActiveValues(
  indicators: ITradingViewIndicatorOption[] | undefined,
): ITradingViewNativeIndicatorState {
  const [activeIndicatorValues, setActiveIndicatorValues] = useState(
    () => new Set<string>(),
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const activeIndicatorValuesRef = useRef(new Set<string>());
  const pendingIndicatorActiveStateRef = useRef(new Map<string, boolean>());

  useEffect(() => {
    if (!indicators) {
      pendingIndicatorActiveStateRef.current.clear();
      const emptyValues = new Set<string>();
      activeIndicatorValuesRef.current = emptyValues;
      setActiveIndicatorValues(emptyValues);
      setIsInitialized(false);
      return;
    }

    const activeValues = getActiveIndicatorValueSet(indicators);
    const pendingActiveState = pendingIndicatorActiveStateRef.current;
    pendingActiveState.forEach((desiredActive, indicatorValue) => {
      if (activeValues.has(indicatorValue) === desiredActive) {
        pendingActiveState.delete(indicatorValue);
      }
    });

    pendingActiveState.forEach((desiredActive, indicatorValue) => {
      if (desiredActive) {
        activeValues.add(indicatorValue);
      } else {
        activeValues.delete(indicatorValue);
      }
    });
    activeIndicatorValuesRef.current = activeValues;
    setActiveIndicatorValues(activeValues);
    setIsInitialized(true);
  }, [indicators]);

  const getActiveIndicatorValues = useCallback(
    () => activeIndicatorValuesRef.current,
    [],
  );

  const updateActiveIndicatorValue = useCallback(
    (indicatorValue: string, desiredActive: boolean) => {
      pendingIndicatorActiveStateRef.current.set(indicatorValue, desiredActive);
      const nextValues = new Set(activeIndicatorValuesRef.current);
      if (desiredActive) {
        nextValues.add(indicatorValue);
      } else {
        nextValues.delete(indicatorValue);
      }
      activeIndicatorValuesRef.current = nextValues;
      setActiveIndicatorValues(nextValues);
    },
    [],
  );

  return useMemo(
    () => ({
      activeIndicatorValues,
      isInitialized,
      getActiveIndicatorValues,
      updateActiveIndicatorValue,
    }),
    [
      activeIndicatorValues,
      getActiveIndicatorValues,
      isInitialized,
      updateActiveIndicatorValue,
    ],
  );
}

export function useNativeIndicatorControls({
  nativeChartControlsConfig,
  nativeIndicatorState,
  maxSubIndicatorCount,
  onIndicatorSelect,
}: {
  nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
  nativeIndicatorState: ITradingViewNativeIndicatorState;
  maxSubIndicatorCount?: number;
  onIndicatorSelect: (indicatorName: string, desiredActive: boolean) => void;
}) {
  const {
    activeIndicatorValues,
    getActiveIndicatorValues,
    updateActiveIndicatorValue,
  } = nativeIndicatorState;
  const indicators = useMemo(
    () => getAppNativeIndicators(activeIndicatorValues),
    [activeIndicatorValues],
  );
  const { mainIndicators, subIndicators } = useMemo(
    () => getIndicatorSections(indicators),
    [indicators],
  );
  const indicatorsEnabled =
    nativeChartControlsConfig?.indicatorsEnabled !== false;
  const hasVisibleIndicators = Boolean(
    nativeChartControlsConfig && indicatorsEnabled && indicators.length,
  );
  const canToggleIndicatorOn = useCallback(
    (indicatorValue: string) =>
      canToggleTradingViewNativeIndicatorOn({
        indicatorValue,
        activeIndicatorValues: getActiveIndicatorValues(),
        maxSubIndicatorCount,
      }),
    [getActiveIndicatorValues, maxSubIndicatorCount],
  );

  const handleIndicatorPress = useCallback(
    (indicator: ITradingViewIndicatorOption) => {
      const currentActiveIndicatorValues = getActiveIndicatorValues();
      if (
        !canToggleTradingViewNativeIndicatorOn({
          indicatorValue: indicator.value,
          activeIndicatorValues: currentActiveIndicatorValues,
          maxSubIndicatorCount,
        })
      ) {
        return;
      }

      const desiredActive = !currentActiveIndicatorValues.has(indicator.value);
      updateActiveIndicatorValue(indicator.value, desiredActive);
      onIndicatorSelect(indicator.label, desiredActive);
    },
    [
      getActiveIndicatorValues,
      maxSubIndicatorCount,
      onIndicatorSelect,
      updateActiveIndicatorValue,
    ],
  );

  return {
    activeIndicatorValues,
    indicators,
    mainIndicators,
    subIndicators,
    hasVisibleIndicators,
    canToggleIndicatorOn,
    handleIndicatorPress,
  };
}
