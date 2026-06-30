import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  IconButton,
  ScrollView,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { CalendarPanelPopover } from '../calendarControls/CalendarPanelPopover';
import { ChartSettingsDialogContent } from '../chartSettings/ChartSettingsDialogContent';
import { ChartTypeSelect } from '../chartType/ChartTypeSelect';
import {
  IndicatorListDialogContent,
  IndicatorPopover,
} from '../indicatorControls/NativeIndicatorControls';
import { TradingViewNativeIntervalSelector } from '../intervalSelector/NativeIntervalSelector';
import { PriceMarketCapSelect } from '../priceMarketCap/PriceMarketCapSelect';
import { HEADER_ICON_BUTTON_STYLE_PROPS } from '../utils/NativeChartControlsShared';

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
  TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT,
  TradingViewNativeIndicatorQuickBar,
} from '../indicatorControls/NativeIndicatorControls';

interface ITradingViewNativeChartControlsProps {
  intervalConfig: ITradingViewIntervalConfigData | null;
  nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
  nativeIndicatorState: ITradingViewNativeIndicatorState;
  chartTypeControlMode?: ITradingViewNativeChartTypeControlMode;
  indicatorControlMode?: ITradingViewNativeIndicatorControlMode;
  intervalControlMode?: ITradingViewNativeIntervalControlMode;
  priceMarketCapControlMode?: ITradingViewNativePriceMarketCapControlMode;
  layoutMode?: ITradingViewNativeControlsLayoutMode;
  chartTimezone: string;
  isFullscreen?: boolean;
  onIntervalChange: (interval: string) => void;
  onIndicatorSelect: (indicatorName: string, desiredActive: boolean) => void;
  onChartTypeChange: (chartType: number) => void;
  onResetLayout: () => void;
  onPriceScaleModeChange: (mode: ITradingViewPriceScaleMode) => void;
  onPriceMarketCapModeChange: (mode: ITradingViewPriceMarketCapMode) => void;
  onCalendarPanelSubmit?: (payload: ICalendarPanelSubmitPayload) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

function ToolbarSeparator() {
  return <Stack h="$6" w="$px" bg="$borderSubdued" flexShrink={0} />;
}

export const TradingViewNativeChartControls = memo(
  ({
    intervalConfig,
    nativeChartControlsConfig,
    nativeIndicatorState,
    chartTypeControlMode = 'toggle',
    indicatorControlMode = 'dialog',
    intervalControlMode = 'dialog',
    priceMarketCapControlMode = 'settings',
    layoutMode = 'mobile',
    chartTimezone,
    isFullscreen = false,
    onIntervalChange,
    onIndicatorSelect,
    onChartTypeChange,
    onResetLayout,
    onPriceScaleModeChange,
    onPriceMarketCapModeChange,
    onCalendarPanelSubmit,
    onUndo,
    onRedo,
    onFullscreenChange,
  }: ITradingViewNativeChartControlsProps) => {
    const intl = useIntl();
    const { updateActiveIndicatorValue } = nativeIndicatorState;
    const isDesktopLayout = layoutMode === 'desktop';
    const hasCalendarControl = Boolean(
      isDesktopLayout && onCalendarPanelSubmit,
    );
    const hasFullscreenControl = Boolean(onFullscreenChange);
    const hasHistoryControls = Boolean(isDesktopLayout && onUndo && onRedo);
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
        const desiredActive = !activeIndicatorValues.has(indicator.value);
        handleNativeIndicatorSelect(indicator.label, desiredActive);
      },
      [activeIndicatorValues, handleNativeIndicatorSelect],
    );

    const showIndicatorsDialog = useCallback(() => {
      Dialog.show({
        title: indicatorsTitle,
        showFooter: false,
        testID: 'trading-view-native-indicators-dialog',
        renderContent: (
          <IndicatorListDialogContent
            indicators={indicators}
            resetLayout={resetLayout}
            onSelect={handleNativeIndicatorSelect}
            onResetLayout={onResetLayout}
          />
        ),
      });
    }, [
      handleNativeIndicatorSelect,
      indicators,
      indicatorsTitle,
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
        onChartTypeChange(nextChartType.value);
      }
    }, [nextChartType, onChartTypeChange]);

    const handleFullscreenToggle = useCallback(() => {
      onFullscreenChange?.(!isFullscreen);
    }, [isFullscreen, onFullscreenChange]);

    const chartTypeControl = useMemo(() => {
      if (showChartTypeSelect) {
        return (
          <ChartTypeSelect
            title={chartStyleTitle}
            chartTypes={chartTypes}
            activeChartType={activeChartType}
            onChartTypeChange={onChartTypeChange}
          />
        );
      }

      if (showChartTypeToggle) {
        return (
          <IconButton
            testID="trading-view-native-chart-type-toggle"
            size="small"
            variant="tertiary"
            icon={chartTypeToggleIcon}
            iconSize="$5"
            title={nextChartTypeLabel}
            onPress={handleChartTypeToggle}
            {...HEADER_ICON_BUTTON_STYLE_PROPS}
          />
        );
      }

      return null;
    }, [
      activeChartType,
      chartStyleTitle,
      chartTypeToggleIcon,
      chartTypes,
      handleChartTypeToggle,
      nextChartTypeLabel,
      onChartTypeChange,
      showChartTypeSelect,
      showChartTypeToggle,
    ]);

    const indicatorControl = useMemo(() => {
      if (!hasVisibleIndicators) {
        return null;
      }

      if (showIndicatorPopover) {
        return (
          <IndicatorPopover
            title={indicatorsTitle}
            indicators={indicators}
            activeIndicatorValues={activeIndicatorValues}
            onIndicatorPress={handleIndicatorPress}
          />
        );
      }

      return (
        <IconButton
          testID="trading-view-native-indicators-trigger"
          size="small"
          variant="tertiary"
          icon="FunctionCustom"
          iconSize="$5"
          title={indicatorsTitle}
          onPress={showIndicatorsDialog}
          {...HEADER_ICON_BUTTON_STYLE_PROPS}
        />
      );
    }, [
      activeIndicatorValues,
      handleIndicatorPress,
      hasVisibleIndicators,
      indicators,
      indicatorsTitle,
      showIndicatorPopover,
      showIndicatorsDialog,
    ]);

    const priceMarketCapControl = useMemo(() => {
      if (!showPriceMarketCapSelect || !priceMarketCap) {
        return null;
      }

      return (
        <PriceMarketCapSelect
          priceMarketCap={priceMarketCap}
          onPriceMarketCapModeChange={onPriceMarketCapModeChange}
        />
      );
    }, [onPriceMarketCapModeChange, priceMarketCap, showPriceMarketCapSelect]);

    const calendarControl =
      hasCalendarControl && onCalendarPanelSubmit ? (
        <CalendarPanelPopover
          chartTimezone={chartTimezone}
          onSubmit={onCalendarPanelSubmit}
        />
      ) : null;

    const settingsControl = settingsEnabled ? (
      <IconButton
        testID="trading-view-native-chart-settings-trigger"
        size="small"
        variant="tertiary"
        icon="SliderHorOutline"
        iconSize="$5"
        title={chartSettingsTitle}
        onPress={showChartSettingsDialog}
        {...HEADER_ICON_BUTTON_STYLE_PROPS}
      />
    ) : null;

    const fullscreenControl = hasFullscreenControl ? (
      <IconButton
        testID="trading-view-native-fullscreen-toggle"
        size="small"
        variant="tertiary"
        icon={isFullscreen ? 'MinimizeOutline' : 'ExpandOutline'}
        iconSize="$5"
        title={intl.formatMessage({
          id: isFullscreen
            ? ETranslations.global_collapse
            : ETranslations.global_expand,
        })}
        onPress={handleFullscreenToggle}
        {...HEADER_ICON_BUTTON_STYLE_PROPS}
      />
    ) : null;

    const undoRedoControls =
      hasHistoryControls && onUndo && onRedo ? (
        <XStack gap="$0.5" alignItems="center" flexShrink={0}>
          <IconButton
            testID="trading-view-native-undo"
            size="small"
            variant="tertiary"
            icon="UndoOutline"
            iconSize="$5"
            title={intl.formatMessage({ id: ETranslations.menu_undo })}
            onPress={onUndo}
            {...HEADER_ICON_BUTTON_STYLE_PROPS}
          />
          <IconButton
            testID="trading-view-native-redo"
            size="small"
            variant="tertiary"
            icon="RedoOutline"
            iconSize="$5"
            title={intl.formatMessage({ id: ETranslations.menu_redo })}
            onPress={onRedo}
            {...HEADER_ICON_BUTTON_STYLE_PROPS}
          />
        </XStack>
      ) : null;

    if (
      !hasVisibleControls &&
      !hasCalendarControl &&
      !hasFullscreenControl &&
      !hasHistoryControls
    ) {
      return null;
    }

    const intervalSelector = hasVisibleIntervalSelector ? (
      <TradingViewNativeIntervalSelector
        intervalConfig={intervalConfig}
        intervalControlMode={intervalControlMode}
        onIntervalChange={onIntervalChange}
      />
    ) : null;
    const hasLeftChartTools = Boolean(
      chartTypeControl ||
      indicatorControl ||
      calendarControl ||
      settingsControl,
    );

    if (isDesktopLayout) {
      return (
        <Stack bg="$bgApp" px="$4" py="$1" zIndex={3}>
          <XStack alignItems="center" width="100%" gap="$2">
            <ScrollView
              horizontal
              flex={1}
              minWidth={0}
              showsHorizontalScrollIndicator={false}
            >
              <XStack alignItems="center" gap="$2" flexShrink={0}>
                {intervalSelector}

                {intervalSelector && hasLeftChartTools ? (
                  <ToolbarSeparator />
                ) : null}

                {hasLeftChartTools ? (
                  <XStack gap="$0.5" alignItems="center" flexShrink={0}>
                    {chartTypeControl}
                    {indicatorControl}
                    {calendarControl}
                    {settingsControl}
                  </XStack>
                ) : null}

                {(intervalSelector || hasLeftChartTools) && undoRedoControls ? (
                  <ToolbarSeparator />
                ) : null}

                {undoRedoControls}
              </XStack>
            </ScrollView>

            <XStack gap="$2" alignItems="center" flexShrink={0}>
              {priceMarketCapControl}

              {priceMarketCapControl && fullscreenControl ? (
                <ToolbarSeparator />
              ) : null}

              {fullscreenControl}
            </XStack>
          </XStack>
        </Stack>
      );
    }

    return (
      <Stack bg="$bgApp" px="$2" py="$2" zIndex={3}>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          width="100%"
          gap="$2"
        >
          <XStack flex={1} minWidth={0} alignItems="center">
            {intervalSelector}
          </XStack>

          <XStack gap="$2" alignItems="center" justifyContent="flex-end">
            {chartTypeControl}
            {priceMarketCapControl}
            {indicatorControl}
            {calendarControl}
            {settingsControl}
            {fullscreenControl}
          </XStack>
        </XStack>
      </Stack>
    );
  },
);

TradingViewNativeChartControls.displayName = 'TradingViewNativeChartControls';
