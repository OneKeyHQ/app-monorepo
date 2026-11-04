import { useMemo } from 'react';

import {
  useMarketTradingViewChartSettingsPersistAtom,
  useMarketTradingViewIndicatorSettingsPersistAtom,
  usePerpsTradingViewChartSettingsPersistAtom,
  usePerpsTradingViewIndicatorSettingsPersistAtom,
  useSwapTradingViewChartSettingsPersistAtom,
  useSwapTradingViewIndicatorSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  getTradingViewNativeSubIndicatorInstances,
  normalizeTradingViewNativeIndicatorSettings,
} from './indicatorSettingsAdapter';

import type { ITradingViewNativeStorageNamespace } from './types';

export function useTradingViewNativeChartSettings(
  namespace: ITradingViewNativeStorageNamespace = 'market',
) {
  const useSettingsAtom = {
    market: useMarketTradingViewChartSettingsPersistAtom,
    perps: usePerpsTradingViewChartSettingsPersistAtom,
    swap: useSwapTradingViewChartSettingsPersistAtom,
  }[namespace];
  return useSettingsAtom();
}

export function useTradingViewNativeIndicatorSettings(
  namespace: ITradingViewNativeStorageNamespace = 'market',
) {
  const useSettingsAtom = {
    market: useMarketTradingViewIndicatorSettingsPersistAtom,
    perps: usePerpsTradingViewIndicatorSettingsPersistAtom,
    swap: useSwapTradingViewIndicatorSettingsPersistAtom,
  }[namespace];
  return useSettingsAtom();
}

// Read during render so a parent can size the chart in the same commit.
export function useTradingViewNativeSubIndicatorCount(
  namespace: ITradingViewNativeStorageNamespace = 'market',
) {
  const [indicatorSettings] = useTradingViewNativeIndicatorSettings(namespace);
  return useMemo(
    () =>
      getTradingViewNativeSubIndicatorInstances(
        normalizeTradingViewNativeIndicatorSettings(indicatorSettings),
      ).length,
    [indicatorSettings],
  );
}
