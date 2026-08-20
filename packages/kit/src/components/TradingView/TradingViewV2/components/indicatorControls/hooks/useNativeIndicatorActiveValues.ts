import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  TRADING_VIEW_NATIVE_ALL_INDICATORS,
  isTradingViewNativeIndicator,
  isTradingViewNativeSubIndicator,
  resolveTradingViewNativeIndicatorId,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/utils/chartIndicators/indicatorCatalog';

import type {
  ITradingViewIndicatorOption,
  ITradingViewNativeChartControlsConfigData,
} from '../../../types';

const APP_NATIVE_INDICATOR_OPTIONS: ITradingViewIndicatorOption[] =
  TRADING_VIEW_NATIVE_ALL_INDICATORS.map((indicator) => ({
    label: indicator,
    value: indicator,
  }));

export interface ITradingViewNativeIndicatorState {
  activeIndicatorValues: Set<string>;
  isInitialized: boolean;
  sourceIndicators: ITradingViewIndicatorOption[] | undefined;
  getActiveIndicatorValues: () => ReadonlySet<string>;
  updateActiveIndicatorValue: (
    indicatorValue: string,
    desiredActive: boolean,
  ) => void;
}

function getAppNativeIndicatorValue(indicator: ITradingViewIndicatorOption) {
  return resolveTradingViewNativeIndicatorId(indicator.value, indicator.label);
}

function hasActiveIndicatorValue(
  activeIndicatorValues: ReadonlySet<string>,
  indicator: ITradingViewIndicatorOption,
  canonicalIndicatorValue: string,
) {
  return (
    activeIndicatorValues.has(canonicalIndicatorValue) ||
    activeIndicatorValues.has(indicator.value)
  );
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

export function getAppNativeIndicators(
  activeIndicatorValues: ReadonlySet<string>,
) {
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
    const indicatorValue = getAppNativeIndicatorValue(indicator);
    if (indicatorValue && isTradingViewNativeIndicator(indicatorValue)) {
      mainIndicators.push(indicator);
    } else if (
      indicatorValue &&
      isTradingViewNativeSubIndicator(indicatorValue)
    ) {
      subIndicators.push(indicator);
    }
  });

  return {
    mainIndicators,
    subIndicators,
  };
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

export function getTradingViewNativeSubIndicatorCountForSnapshot({
  activeIndicatorValues,
  configIndicators,
  isInitialized,
  sourceIndicators,
}: {
  activeIndicatorValues: ReadonlySet<string>;
  configIndicators: ITradingViewIndicatorOption[] | undefined;
  isInitialized: boolean;
  sourceIndicators: ITradingViewIndicatorOption[] | undefined;
}) {
  if (isInitialized && sourceIndicators === configIndicators) {
    return getTradingViewNativeSubIndicatorCount(activeIndicatorValues);
  }

  return getTradingViewNativeSubIndicatorCountFromOptions(configIndicators);
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
}): Array<[indicatorId: string, desiredActive: boolean]> {
  const removedIndicators = indicators.flatMap<[string, boolean]>(
    (indicator) => {
      const indicatorValue = getAppNativeIndicatorValue(indicator);
      return indicatorValue !== null &&
        hasActiveIndicatorValue(
          originalActiveIndicatorValues,
          indicator,
          indicatorValue,
        ) &&
        !hasActiveIndicatorValue(
          nextActiveIndicatorValues,
          indicator,
          indicatorValue,
        )
        ? [[indicatorValue, false]]
        : [];
    },
  );
  const addedIndicators = indicators.flatMap<[string, boolean]>((indicator) => {
    const indicatorValue = getAppNativeIndicatorValue(indicator);
    return indicatorValue !== null &&
      !hasActiveIndicatorValue(
        originalActiveIndicatorValues,
        indicator,
        indicatorValue,
      ) &&
      hasActiveIndicatorValue(
        nextActiveIndicatorValues,
        indicator,
        indicatorValue,
      )
      ? [[indicatorValue, true]]
      : [];
  });

  return [...removedIndicators, ...addedIndicators];
}

export function useNativeIndicatorActiveValues(
  indicators: ITradingViewIndicatorOption[] | undefined,
): ITradingViewNativeIndicatorState {
  const [activeIndicatorValues, setActiveIndicatorValues] = useState(
    () => new Set<string>(),
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [sourceIndicators, setSourceIndicators] = useState<
    ITradingViewIndicatorOption[] | undefined
  >(undefined);
  const activeIndicatorValuesRef = useRef(new Set<string>());
  const pendingIndicatorActiveStateRef = useRef(new Map<string, boolean>());

  useEffect(() => {
    if (!indicators) {
      pendingIndicatorActiveStateRef.current.clear();
      const emptyValues = new Set<string>();
      activeIndicatorValuesRef.current = emptyValues;
      setActiveIndicatorValues(emptyValues);
      setIsInitialized(false);
      setSourceIndicators(undefined);
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
    setSourceIndicators(indicators);
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
      sourceIndicators,
      getActiveIndicatorValues,
      updateActiveIndicatorValue,
    }),
    [
      activeIndicatorValues,
      getActiveIndicatorValues,
      isInitialized,
      sourceIndicators,
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
      onIndicatorSelect(indicator.value, desiredActive);
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
