import { useMemo } from 'react';

import {
  getTradingViewNativeSubIndicatorInstances,
  normalizeTradingViewNativeIndicatorSettings,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/indicatorSettingsAdapter';
import { normalizeTradingViewMultiChartLayout } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/multiChartLayout';
import {
  useMarketTradingViewIndicatorSettingsPersistAtom,
  useMarketTradingViewLayoutPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function useMarketNativeChartLayout() {
  const [storedLayout] = useMarketTradingViewLayoutPersistAtom();
  const [defaultIndicatorSettings] =
    useMarketTradingViewIndicatorSettingsPersistAtom();

  // Read the rendered panel's settings during render; chart callbacks arrive after paint.
  return useMemo(() => {
    const layout = normalizeTradingViewMultiChartLayout(storedLayout);
    const primaryPanelId = layout.panelOrder[0];
    const settings =
      primaryPanelId === 'main'
        ? defaultIndicatorSettings
        : (layout.panelSettings[primaryPanelId]?.indicatorSettings ??
          defaultIndicatorSettings);
    return {
      panelCount: layout.panelCount,
      subIndicatorCount: getTradingViewNativeSubIndicatorInstances(
        normalizeTradingViewNativeIndicatorSettings(settings),
      ).length,
    };
  }, [defaultIndicatorSettings, storedLayout]);
}
