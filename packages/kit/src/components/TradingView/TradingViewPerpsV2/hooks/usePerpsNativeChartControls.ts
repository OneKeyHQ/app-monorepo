import { useCallback, useState } from 'react';

import { useTradingViewIntervalSync } from '../../TradingViewV2/components/tradingViewV2/hooks/useTradingViewIntervalSync';
import {
  type ICalendarPanelSubmitPayload,
  useNativeIndicatorActiveValues,
} from '../../TradingViewV2/components/TradingViewV2ChartControls';

import type { IWebViewRef } from '../../../WebView/types';
import type {
  ITradingViewIntervalConfigData,
  ITradingViewNativeChartControlsConfigData,
  ITradingViewPriceMarketCapMode,
  ITradingViewPriceScaleMode,
} from '../../TradingViewV2/types';

export function usePerpsNativeChartControls({
  enabled,
  webRef,
}: {
  enabled: boolean;
  webRef: React.RefObject<IWebViewRef | null>;
}) {
  const [intervalConfig, setIntervalConfig] =
    useState<ITradingViewIntervalConfigData | null>(null);
  const [nativeChartControlsConfig, setNativeChartControlsConfig] =
    useState<ITradingViewNativeChartControlsConfigData | null>(null);
  const nativeIndicatorState = useNativeIndicatorActiveValues(
    nativeChartControlsConfig?.indicators,
  );
  const sendMessage = useCallback(
    (type: string, payload: object = {}) => {
      webRef.current?.sendMessageViaInjectedScript({ type, payload });
    },
    [webRef],
  );
  const handleIntervalChange = useCallback(
    (interval: string) => {
      setIntervalConfig((prev) =>
        prev ? { ...prev, activeInterval: interval, persist: false } : prev,
      );
      sendMessage('TRADINGVIEW_INTERVAL_CHANGE', {
        interval,
        resetPriceScaleRange: true,
      });
    },
    [sendMessage],
  );
  const {
    displayedIntervalConfig,
    initialInterval,
    isRestoringInterval,
    reset: resetIntervalSync,
    saveInterval,
  } = useTradingViewIntervalSync({
    namespace: enabled ? 'perps' : undefined,
    intervalConfig,
    isReady:
      enabled &&
      Boolean(nativeChartControlsConfig) &&
      nativeChartControlsConfig?.layoutRestored !== false,
    onIntervalChange: handleIntervalChange,
  });
  const handleSelectedIntervalChange = useCallback(
    (interval: string) => {
      saveInterval(interval);
      handleIntervalChange(interval);
    },
    [handleIntervalChange, saveInterval],
  );
  const handleNativeChartControlsConfigChange = useCallback(
    (config: ITradingViewNativeChartControlsConfigData) => {
      setNativeChartControlsConfig(config);
      if (config.intervals?.length && config.activeInterval) {
        setIntervalConfig({
          intervals: config.intervals,
          activeInterval: config.activeInterval,
          persist: false,
          timestamp: config.timestamp,
        });
      }
    },
    [],
  );
  const handleIndicatorSelect = useCallback(
    (indicatorName: string, desiredActive: boolean) => {
      sendMessage('TRADINGVIEW_INDICATOR_SELECT', {
        indicatorName,
        desiredActive,
      });
    },
    [sendMessage],
  );
  const handleChartTypeChange = useCallback(
    (chartType: number) => {
      setNativeChartControlsConfig((prev) =>
        prev ? { ...prev, activeChartType: chartType } : prev,
      );
      sendMessage('TRADINGVIEW_CHART_TYPE_CHANGE', { chartType });
    },
    [sendMessage],
  );
  const handlePriceScaleModeChange = useCallback(
    (priceScaleMode: ITradingViewPriceScaleMode) => {
      sendMessage('TRADINGVIEW_PRICE_SCALE_CHANGE', { priceScaleMode });
    },
    [sendMessage],
  );
  const handlePriceMarketCapModeChange = useCallback(
    (priceMarketCapMode: ITradingViewPriceMarketCapMode) => {
      sendMessage('TRADINGVIEW_PRICE_MARKET_CAP_CHANGE', {
        priceMarketCapMode,
      });
    },
    [sendMessage],
  );
  const handleResetLayout = useCallback(() => {
    sendMessage('TRADINGVIEW_RESET_LAYOUT');
  }, [sendMessage]);
  const handleOpenChartSettings = useCallback(() => {
    sendMessage('TRADINGVIEW_OPEN_CHART_SETTINGS');
  }, [sendMessage]);
  const handleControlInteraction = useCallback(() => {
    sendMessage('TRADINGVIEW_CLOSE_POPUPS_AND_DIALOGS');
  }, [sendMessage]);
  const handleCalendarPanelSubmit = useCallback(
    (payload: ICalendarPanelSubmitPayload) => {
      sendMessage('TRADINGVIEW_CALENDAR_PANEL_SUBMIT', {
        ...payload,
        resetPriceScaleRange: true,
      });
    },
    [sendMessage],
  );
  const reset = useCallback(() => {
    setIntervalConfig(null);
    setNativeChartControlsConfig(null);
    resetIntervalSync();
  }, [resetIntervalSync]);

  return {
    initialInterval,
    isRestoringInterval,
    reset,
    onIntervalConfigChange: setIntervalConfig,
    onNativeChartControlsConfigChange: handleNativeChartControlsConfigChange,
    controlsProps: {
      intervalConfig: displayedIntervalConfig,
      nativeChartControlsConfig,
      nativeIndicatorState,
      onIntervalChange: handleSelectedIntervalChange,
      onIndicatorSelect: handleIndicatorSelect,
      onChartTypeChange: handleChartTypeChange,
      onResetLayout: handleResetLayout,
      onPriceScaleModeChange: handlePriceScaleModeChange,
      onPriceMarketCapModeChange: handlePriceMarketCapModeChange,
      onOpenChartSettings: handleOpenChartSettings,
      onControlInteraction: handleControlInteraction,
      onCalendarPanelSubmit: handleCalendarPanelSubmit,
    },
  };
}
