import {
  useMarketTradingViewChartSettingsPersistAtom,
  useMarketTradingViewIndicatorSettingsPersistAtom,
  useMarketTradingViewLayoutPersistAtom,
  usePerpsTradingViewChartSettingsPersistAtom,
  usePerpsTradingViewIndicatorSettingsPersistAtom,
  usePerpsTradingViewLayoutPersistAtom,
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

export function useTradingViewNativeLayout(
  namespace: ITradingViewNativeStorageNamespace = 'market',
) {
  const useLayoutAtom =
    namespace === 'perps'
      ? usePerpsTradingViewLayoutPersistAtom
      : useMarketTradingViewLayoutPersistAtom;
  return useLayoutAtom();
}
