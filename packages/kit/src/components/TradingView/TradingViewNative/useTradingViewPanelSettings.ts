import { useCallback } from 'react';
import type { SetStateAction } from 'react';

import {
  useMarketTradingViewChartSettingsPersistAtom,
  useMarketTradingViewIndicatorSettingsPersistAtom,
  useMarketTradingViewLayoutPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ITradingViewNativeChartSettings,
  ITradingViewNativeIndicatorSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

export function useTradingViewPanelSettings(panelId: string) {
  const [layout, setLayout] = useMarketTradingViewLayoutPersistAtom();
  const [defaultChartSettings] = useMarketTradingViewChartSettingsPersistAtom();
  const [defaultIndicatorSettings] =
    useMarketTradingViewIndicatorSettingsPersistAtom();
  const settings = layout.panelSettings[panelId];
  const setChartSettings = useCallback(
    (update: SetStateAction<ITradingViewNativeChartSettings>) =>
      setLayout((current) => {
        const panel = current.panelSettings[panelId] ?? {
          chartSettings: defaultChartSettings,
          indicatorSettings: defaultIndicatorSettings,
        };
        return {
          ...current,
          panelSettings: {
            ...current.panelSettings,
            [panelId]: {
              ...panel,
              chartSettings:
                typeof update === 'function'
                  ? update(panel.chartSettings)
                  : update,
            },
          },
        };
      }),
    [defaultChartSettings, defaultIndicatorSettings, panelId, setLayout],
  );
  const setIndicatorSettings = useCallback(
    (update: SetStateAction<ITradingViewNativeIndicatorSettings>) =>
      setLayout((current) => {
        const panel = current.panelSettings[panelId] ?? {
          chartSettings: defaultChartSettings,
          indicatorSettings: defaultIndicatorSettings,
        };
        return {
          ...current,
          panelSettings: {
            ...current.panelSettings,
            [panelId]: {
              ...panel,
              indicatorSettings:
                typeof update === 'function'
                  ? update(panel.indicatorSettings)
                  : update,
            },
          },
        };
      }),
    [defaultChartSettings, defaultIndicatorSettings, panelId, setLayout],
  );
  const chartSettingsState: ReturnType<
    typeof useMarketTradingViewChartSettingsPersistAtom
  > = [settings?.chartSettings ?? defaultChartSettings, setChartSettings];
  const indicatorSettingsState: ReturnType<
    typeof useMarketTradingViewIndicatorSettingsPersistAtom
  > = [
    settings?.indicatorSettings ?? defaultIndicatorSettings,
    setIndicatorSettings,
  ];
  return { chartSettingsState, indicatorSettingsState };
}
