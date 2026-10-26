import {
  useMarketTradingViewChartSettingsPersistAtom,
  useMarketTradingViewIndicatorSettingsPersistAtom,
  usePerpsTradingViewChartSettingsPersistAtom,
  usePerpsTradingViewIndicatorSettingsPersistAtom,
  useSwapTradingViewChartSettingsPersistAtom,
  useSwapTradingViewIndicatorSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

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
