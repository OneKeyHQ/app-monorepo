import { useMemo } from 'react';

import {
  getTradingViewNativeSubIndicatorInstances,
  normalizeTradingViewNativeIndicatorSettings,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/indicatorSettingsAdapter';
import { useMarketTradingViewIndicatorSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function useMarketNativeChartLayout() {
  const [indicatorSettings] =
    useMarketTradingViewIndicatorSettingsPersistAtom();

  // Read indicator settings during render; chart callbacks arrive after paint.
  return useMemo(() => {
    return {
      subIndicatorCount: getTradingViewNativeSubIndicatorInstances(
        normalizeTradingViewNativeIndicatorSettings(indicatorSettings),
      ).length,
    };
  }, [indicatorSettings]);
}
