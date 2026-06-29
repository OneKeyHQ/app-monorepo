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

export function useNativeIndicatorActiveValues(
  indicators: ITradingViewIndicatorOption[] | undefined,
): ITradingViewNativeIndicatorState {
  const [activeIndicatorValues, setActiveIndicatorValues] = useState(
    () => new Set<string>(),
  );
  const pendingIndicatorActiveStateRef = useRef(new Map<string, boolean>());

  useEffect(() => {
    if (!indicators) {
      pendingIndicatorActiveStateRef.current.clear();
      setActiveIndicatorValues(new Set<string>());
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
    setActiveIndicatorValues(activeValues);
  }, [indicators]);

  const updateActiveIndicatorValue = useCallback(
    (indicatorValue: string, desiredActive: boolean) => {
      pendingIndicatorActiveStateRef.current.set(indicatorValue, desiredActive);
      setActiveIndicatorValues((currentValues) => {
        const nextValues = new Set(currentValues);
        if (desiredActive) {
          nextValues.add(indicatorValue);
        } else {
          nextValues.delete(indicatorValue);
        }
        return nextValues;
      });
    },
    [],
  );

  return {
    activeIndicatorValues,
    updateActiveIndicatorValue,
  };
}

export function useNativeIndicatorControls({
  nativeChartControlsConfig,
  nativeIndicatorState,
  onIndicatorSelect,
}: {
  nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
  nativeIndicatorState: ITradingViewNativeIndicatorState;
  onIndicatorSelect: (indicatorName: string, desiredActive: boolean) => void;
}) {
  const { activeIndicatorValues, updateActiveIndicatorValue } =
    nativeIndicatorState;
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

  const handleIndicatorPress = useCallback(
    (indicator: ITradingViewIndicatorOption) => {
      const desiredActive = !activeIndicatorValues.has(indicator.value);
      updateActiveIndicatorValue(indicator.value, desiredActive);
      onIndicatorSelect(indicator.label, desiredActive);
    },
    [activeIndicatorValues, onIndicatorSelect, updateActiveIndicatorValue],
  );

  return {
    activeIndicatorValues,
    indicators,
    mainIndicators,
    subIndicators,
    hasVisibleIndicators,
    handleIndicatorPress,
  };
}
