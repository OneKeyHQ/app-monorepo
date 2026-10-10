import { useCallback } from 'react';
import type { SetStateAction } from 'react';

import type {
  ITradingViewNativeChartSettings,
  ITradingViewNativeIndicatorSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import {
  useTradingViewNativeChartSettings,
  useTradingViewNativeIndicatorSettings,
  useTradingViewNativeLayout,
} from './useTradingViewNativeSettings';

import type { ITradingViewNativeStorageNamespace } from './types';

export function useTradingViewPanelSettings(
  panelId: string,
  storageNamespace?: ITradingViewNativeStorageNamespace,
) {
  const [layout, setLayout] = useTradingViewNativeLayout(storageNamespace);
  const [defaultChartSettings] =
    useTradingViewNativeChartSettings(storageNamespace);
  const [defaultIndicatorSettings] =
    useTradingViewNativeIndicatorSettings(storageNamespace);
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
    typeof useTradingViewNativeChartSettings
  > = [settings?.chartSettings ?? defaultChartSettings, setChartSettings];
  const indicatorSettingsState: ReturnType<
    typeof useTradingViewNativeIndicatorSettings
  > = [
    settings?.indicatorSettings ?? defaultIndicatorSettings,
    setIndicatorSettings,
  ];
  return { chartSettingsState, indicatorSettingsState };
}
