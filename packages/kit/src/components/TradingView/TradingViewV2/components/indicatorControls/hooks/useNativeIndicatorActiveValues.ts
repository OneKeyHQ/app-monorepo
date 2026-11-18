import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  canToggleTradingViewNativeIndicatorOn,
  getAppNativeIndicators,
  getIndicatorSections,
  getTradingViewNativeSubIndicatorCount,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/indicatorSelector/indicatorUtils';
import { resolveTradingViewNativeIndicatorId } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/utils/chartIndicators/indicatorCatalog';

import type {
  ITradingViewIndicatorOption,
  ITradingViewNativeChartControlsConfigData,
} from '../../../types';

export {
  canToggleTradingViewNativeIndicatorOn,
  getAppNativeIndicators,
  getIndicatorSections,
  getNativeIndicatorSelectionUpdates,
  getTradingViewNativeSubIndicatorCount,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/indicatorSelector/indicatorUtils';

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
  maxSelectableSubIndicatorCount,
  onIndicatorSelect,
}: {
  nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
  nativeIndicatorState: ITradingViewNativeIndicatorState;
  maxSelectableSubIndicatorCount?: number;
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
        maxSelectableSubIndicatorCount,
      }),
    [getActiveIndicatorValues, maxSelectableSubIndicatorCount],
  );

  const handleIndicatorPress = useCallback(
    (indicator: ITradingViewIndicatorOption) => {
      const currentActiveIndicatorValues = getActiveIndicatorValues();
      if (
        !canToggleTradingViewNativeIndicatorOn({
          indicatorValue: indicator.value,
          activeIndicatorValues: currentActiveIndicatorValues,
          maxSelectableSubIndicatorCount,
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
      maxSelectableSubIndicatorCount,
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
