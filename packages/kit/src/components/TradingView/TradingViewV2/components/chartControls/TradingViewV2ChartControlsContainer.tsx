import { type ReactNode, memo, useCallback } from 'react';

import { Dialog } from '@onekeyhq/components';
import { TradingViewChartControls } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';

import { ChartSettingsDialogContent } from '../chartSettings/ChartSettingsDialogContent';
import { canToggleTradingViewNativeIndicatorOn } from '../indicatorControls/hooks/useNativeIndicatorActiveValues';
import { IndicatorListDialogContent } from '../indicatorControls/NativeIndicatorControls';

import { useNativeChartControls } from './hooks/useNativeChartControls';

import type {
  ITradingViewIndicatorOption,
  ITradingViewIntervalConfigData,
  ITradingViewNativeChartControlsConfigData,
  ITradingViewPriceMarketCapMode,
  ITradingViewPriceScaleMode,
} from '../../types';
import type { ICalendarPanelSubmitPayload } from '../calendarControls/CalendarPanelPopover';
import type { ITradingViewNativeIndicatorState } from '../indicatorControls/hooks/useNativeIndicatorActiveValues';
import type { ITradingViewNativeIntervalControlMode } from '../intervalSelector/NativeIntervalSelector';
import type {
  ITradingViewNativeChartTypeControlMode,
  ITradingViewNativeControlsLayoutMode,
  ITradingViewNativeIndicatorControlMode,
  ITradingViewNativePriceMarketCapControlMode,
} from '../utils/NativeChartControlsShared';

export type {
  ITradingViewNativeChartTypeControlMode,
  ITradingViewNativeControlsLayoutMode,
  ITradingViewNativeIndicatorControlMode,
  ITradingViewNativePriceMarketCapControlMode,
} from '../utils/NativeChartControlsShared';
export type { ITradingViewNativeIndicatorState } from '../indicatorControls/hooks/useNativeIndicatorActiveValues';
export type { ITradingViewNativeIntervalControlMode } from '../intervalSelector/NativeIntervalSelector';
export type { ICalendarPanelSubmitPayload } from '../calendarControls/CalendarPanelPopover';
export { useNativeIndicatorActiveValues } from '../indicatorControls/hooks/useNativeIndicatorActiveValues';
export {
  getTradingViewNativeSubIndicatorCount,
  getTradingViewNativeSubIndicatorCountFromOptions,
} from '../indicatorControls/hooks/useNativeIndicatorActiveValues';
export {
  TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT,
  TradingViewNativeIndicatorQuickBar,
} from '../indicatorControls/NativeIndicatorControls';
export { TRADING_VIEW_CHART_CONTROLS_HEIGHT as TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';

interface ITradingViewV2ChartControlsContainerProps {
  intervalConfig: ITradingViewIntervalConfigData | null;
  nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
  nativeIndicatorState: ITradingViewNativeIndicatorState;
  maxSubIndicatorCount?: number;
  isControlsReady?: boolean;
  chartTypeControlMode?: ITradingViewNativeChartTypeControlMode;
  indicatorControlMode?: ITradingViewNativeIndicatorControlMode;
  intervalControlMode?: ITradingViewNativeIntervalControlMode;
  priceMarketCapControlMode?: ITradingViewNativePriceMarketCapControlMode;
  layoutMode?: ITradingViewNativeControlsLayoutMode;
  chartTimezone: string;
  isFullscreen?: boolean;
  fullscreenHeader?: ReactNode;
  onIntervalChange: (interval: string) => void;
  onIndicatorSelect: (indicatorName: string, desiredActive: boolean) => void;
  onChartTypeChange: (chartType: number) => void;
  onResetLayout: () => void;
  onPriceScaleModeChange: (mode: ITradingViewPriceScaleMode) => void;
  onPriceMarketCapModeChange: (mode: ITradingViewPriceMarketCapMode) => void;
  onCalendarPanelSubmit?: (payload: ICalendarPanelSubmitPayload) => void;
  onOpenChartSettings?: () => void;
  onControlInteraction?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export const TradingViewV2ChartControlsContainer = memo(
  ({
    intervalConfig,
    nativeChartControlsConfig,
    nativeIndicatorState,
    maxSubIndicatorCount,
    isControlsReady = true,
    chartTypeControlMode = 'toggle',
    indicatorControlMode = 'dialog',
    intervalControlMode = 'dialog',
    priceMarketCapControlMode = 'settings',
    layoutMode = 'mobile',
    chartTimezone,
    isFullscreen = false,
    fullscreenHeader,
    onIntervalChange,
    onIndicatorSelect,
    onChartTypeChange,
    onResetLayout,
    onPriceScaleModeChange,
    onPriceMarketCapModeChange,
    onCalendarPanelSubmit,
    onOpenChartSettings,
    onControlInteraction,
    onUndo,
    onRedo,
    onFullscreenChange,
  }: ITradingViewV2ChartControlsContainerProps) => {
    const { getActiveIndicatorValues, updateActiveIndicatorValue } =
      nativeIndicatorState;
    const {
      activeChartType,
      activeIndicatorValues,
      chartSettingsTitle,
      chartStyleTitle,
      chartTypeToggleIcon,
      chartTypes,
      hasVisibleControls,
      hasVisibleIndicators,
      hasVisibleIntervalSelector,
      indicators,
      indicatorsTitle,
      nextChartType,
      nextChartTypeLabel,
      priceMarketCap,
      priceMarketCapSettings,
      priceScale,
      resetLayout,
      settingsEnabled,
      showChartTypeSelect,
      showChartTypeToggle,
      showIndicatorPopover,
      showPriceMarketCapSelect,
    } = useNativeChartControls({
      intervalConfig,
      nativeChartControlsConfig,
      nativeIndicatorState,
      chartTypeControlMode,
      indicatorControlMode,
      priceMarketCapControlMode,
    });

    const handleNativeIndicatorSelect = useCallback(
      (indicatorName: string, desiredActive: boolean) => {
        updateActiveIndicatorValue(indicatorName, desiredActive);
        onIndicatorSelect(indicatorName, desiredActive);
      },
      [onIndicatorSelect, updateActiveIndicatorValue],
    );

    const handleIndicatorPress = useCallback(
      (indicator: ITradingViewIndicatorOption) => {
        const currentActiveIndicatorValues = getActiveIndicatorValues();
        if (
          !canToggleTradingViewNativeIndicatorOn({
            indicatorValue: indicator.value,
            activeIndicatorValues: currentActiveIndicatorValues,
            maxSubIndicatorCount,
          })
        ) {
          return;
        }

        const desiredActive = !currentActiveIndicatorValues.has(
          indicator.value,
        );
        handleNativeIndicatorSelect(indicator.label, desiredActive);
      },
      [
        getActiveIndicatorValues,
        handleNativeIndicatorSelect,
        maxSubIndicatorCount,
      ],
    );

    const showIndicatorsDialog = useCallback(() => {
      onControlInteraction?.();
      Dialog.show({
        title: indicatorsTitle,
        showFooter: false,
        testID: 'trading-view-native-indicators-dialog',
        renderContent: (
          <IndicatorListDialogContent
            indicators={indicators}
            resetLayout={resetLayout}
            maxSubIndicatorCount={maxSubIndicatorCount}
            onSelect={handleNativeIndicatorSelect}
            onResetLayout={onResetLayout}
          />
        ),
      });
    }, [
      handleNativeIndicatorSelect,
      indicators,
      indicatorsTitle,
      maxSubIndicatorCount,
      onControlInteraction,
      onResetLayout,
      resetLayout,
    ]);

    const showChartSettingsDialog = useCallback(() => {
      if (!settingsEnabled) {
        return;
      }

      Dialog.show({
        title: chartSettingsTitle,
        showFooter: false,
        testID: 'trading-view-native-chart-settings-dialog',
        renderContent: (
          <ChartSettingsDialogContent
            chartTypes={chartTypes}
            activeChartType={activeChartType}
            priceMarketCap={priceMarketCapSettings}
            priceScale={priceScale}
            onChartTypeChange={onChartTypeChange}
            onPriceMarketCapModeChange={onPriceMarketCapModeChange}
            onPriceScaleModeChange={onPriceScaleModeChange}
          />
        ),
      });
    }, [
      activeChartType,
      chartSettingsTitle,
      chartTypes,
      onChartTypeChange,
      onPriceMarketCapModeChange,
      onPriceScaleModeChange,
      priceMarketCapSettings,
      priceScale,
      settingsEnabled,
    ]);

    const handleChartTypeToggle = useCallback(() => {
      if (nextChartType) {
        onControlInteraction?.();
        onChartTypeChange(nextChartType.value);
      }
    }, [nextChartType, onChartTypeChange, onControlInteraction]);

    const handleFullscreenToggle = useCallback(() => {
      onControlInteraction?.();
      onFullscreenChange?.(!isFullscreen);
    }, [isFullscreen, onControlInteraction, onFullscreenChange]);

    const handleUndo = useCallback(() => {
      onControlInteraction?.();
      onUndo?.();
    }, [onControlInteraction, onUndo]);

    const handleRedo = useCallback(() => {
      onControlInteraction?.();
      onRedo?.();
    }, [onControlInteraction, onRedo]);

    const handleSettingsPress = useCallback(() => {
      if (onOpenChartSettings) {
        onOpenChartSettings();
        return;
      }

      showChartSettingsDialog();
    }, [onOpenChartSettings, showChartSettingsDialog]);

    return (
      <TradingViewChartControls
        intervalConfig={intervalConfig}
        activeChartType={activeChartType}
        activeIndicatorValues={activeIndicatorValues}
        chartSettingsTitle={chartSettingsTitle}
        chartStyleTitle={chartStyleTitle}
        chartTypeToggleIcon={chartTypeToggleIcon}
        chartTypes={chartTypes}
        hasVisibleControls={hasVisibleControls}
        hasVisibleIndicators={hasVisibleIndicators}
        hasVisibleIntervalSelector={hasVisibleIntervalSelector}
        indicators={indicators}
        indicatorsTitle={indicatorsTitle}
        nextChartTypeLabel={nextChartTypeLabel}
        priceMarketCap={priceMarketCap}
        settingsEnabled={settingsEnabled}
        showChartTypeSelect={showChartTypeSelect}
        showChartTypeToggle={showChartTypeToggle}
        showIndicatorPopover={showIndicatorPopover}
        showPriceMarketCapSelect={showPriceMarketCapSelect}
        maxSubIndicatorCount={maxSubIndicatorCount}
        isControlsReady={isControlsReady}
        intervalControlMode={intervalControlMode}
        layoutMode={layoutMode}
        chartTimezone={chartTimezone}
        isFullscreen={isFullscreen}
        fullscreenHeader={fullscreenHeader}
        onIntervalChange={onIntervalChange}
        onIndicatorPress={handleIndicatorPress}
        onShowIndicatorsDialog={showIndicatorsDialog}
        onChartTypeChange={onChartTypeChange}
        onChartTypeToggle={handleChartTypeToggle}
        onPriceMarketCapModeChange={onPriceMarketCapModeChange}
        onCalendarPanelSubmit={onCalendarPanelSubmit}
        onSettingsPress={handleSettingsPress}
        onControlInteraction={onControlInteraction}
        onUndo={onUndo ? handleUndo : undefined}
        onRedo={onRedo ? handleRedo : undefined}
        onFullscreenToggle={
          onFullscreenChange ? handleFullscreenToggle : undefined
        }
      />
    );
  },
);

TradingViewV2ChartControlsContainer.displayName =
  'TradingViewV2ChartControlsContainer';
