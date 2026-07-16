import { type ReactNode, memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { IconButton, ScrollView, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { CalendarPanelPopover } from '../TradingViewV2/components/calendarControls/CalendarPanelPopover';
import { ChartTypeSelect } from '../TradingViewV2/components/chartType/ChartTypeSelect';
import { IndicatorPopover } from '../TradingViewV2/components/indicatorControls/NativeIndicatorControls';
import { TradingViewNativeIntervalSelector } from '../TradingViewV2/components/intervalSelector/NativeIntervalSelector';
import { PriceMarketCapSelect } from '../TradingViewV2/components/priceMarketCap/PriceMarketCapSelect';
import { HEADER_ICON_BUTTON_STYLE_PROPS } from '../TradingViewV2/components/utils/NativeChartControlsShared';

import type { ICalendarPanelSubmitPayload } from '../TradingViewV2/components/calendarControls/CalendarPanelPopover';
import type { ITradingViewNativeIntervalControlMode } from '../TradingViewV2/components/intervalSelector/NativeIntervalSelector';
import type { ITradingViewNativeControlsLayoutMode } from '../TradingViewV2/components/utils/NativeChartControlsShared';
import type {
  ITradingViewChartTypeOption,
  ITradingViewIndicatorOption,
  ITradingViewIntervalConfigData,
  ITradingViewNativeChartControlsConfigData,
  ITradingViewPriceMarketCapMode,
} from '../TradingViewV2/types';

type IPriceMarketCapConfig =
  ITradingViewNativeChartControlsConfigData['priceMarketCap'];

export interface ITradingViewChartControlsProps {
  intervalConfig: ITradingViewIntervalConfigData | null;
  activeChartType: number | undefined;
  activeIndicatorValues: Set<string>;
  chartSettingsTitle: string;
  chartStyleTitle: string;
  chartTypeToggleIcon: IKeyOfIcons;
  chartTypes: ITradingViewChartTypeOption[];
  hasVisibleControls: boolean;
  hasVisibleIndicators: boolean;
  hasVisibleIntervalSelector: boolean;
  indicators: ITradingViewIndicatorOption[];
  indicatorsTitle: string;
  nextChartTypeLabel: string;
  priceMarketCap: IPriceMarketCapConfig;
  settingsEnabled: boolean;
  showChartTypeSelect: boolean;
  showChartTypeToggle: boolean;
  showIndicatorPopover: boolean;
  showPriceMarketCapSelect: boolean;
  maxSubIndicatorCount?: number;
  isControlsReady: boolean;
  intervalControlMode: ITradingViewNativeIntervalControlMode;
  layoutMode: ITradingViewNativeControlsLayoutMode;
  chartTimezone: string;
  isFullscreen: boolean;
  fullscreenHeader?: ReactNode;
  onIntervalChange: (interval: string) => void;
  onIndicatorPress: (indicator: ITradingViewIndicatorOption) => void;
  onShowIndicatorsDialog: () => void;
  onChartTypeChange: (chartType: number) => void;
  onChartTypeToggle: () => void;
  onPriceMarketCapModeChange: (mode: ITradingViewPriceMarketCapMode) => void;
  onCalendarPanelSubmit?: (payload: ICalendarPanelSubmitPayload) => void;
  onSettingsPress: () => void;
  onControlInteraction?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onFullscreenToggle?: () => void;
}

function ToolbarSeparator() {
  return <Stack h="$6" w="$px" bg="$borderSubdued" flexShrink={0} />;
}

const DESKTOP_CONTROLS_HEIGHT = 38;
const DESKTOP_FULLSCREEN_CONTROLS_HEIGHT = 64;
export const TRADING_VIEW_CHART_CONTROLS_HEIGHT = 48;

export const TradingViewChartControls = memo(
  ({
    intervalConfig,
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
    nextChartTypeLabel,
    priceMarketCap,
    settingsEnabled,
    showChartTypeSelect,
    showChartTypeToggle,
    showIndicatorPopover,
    showPriceMarketCapSelect,
    maxSubIndicatorCount,
    isControlsReady,
    intervalControlMode,
    layoutMode,
    chartTimezone,
    isFullscreen,
    fullscreenHeader,
    onIntervalChange,
    onIndicatorPress,
    onShowIndicatorsDialog,
    onChartTypeChange,
    onChartTypeToggle,
    onPriceMarketCapModeChange,
    onCalendarPanelSubmit,
    onSettingsPress,
    onControlInteraction,
    onUndo,
    onRedo,
    onFullscreenToggle,
  }: ITradingViewChartControlsProps) => {
    const intl = useIntl();
    const isDesktopLayout = layoutMode === 'desktop';
    const hasCalendarControl = Boolean(
      isDesktopLayout && onCalendarPanelSubmit,
    );
    const hasFullscreenControl = Boolean(onFullscreenToggle);
    const hasHistoryControls = Boolean(isDesktopLayout && onUndo && onRedo);
    const desktopFullscreenHeader =
      isDesktopLayout && isFullscreen ? fullscreenHeader : null;

    const chartTypeControl = useMemo(() => {
      if (showChartTypeSelect) {
        return (
          <ChartTypeSelect
            title={chartStyleTitle}
            chartTypes={chartTypes}
            activeChartType={activeChartType}
            onChartTypeChange={onChartTypeChange}
            onControlInteraction={onControlInteraction}
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
            onPress={onChartTypeToggle}
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
      nextChartTypeLabel,
      onChartTypeChange,
      onChartTypeToggle,
      onControlInteraction,
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
            maxSubIndicatorCount={maxSubIndicatorCount}
            onIndicatorPress={onIndicatorPress}
            onControlInteraction={onControlInteraction}
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
          onPress={onShowIndicatorsDialog}
          {...HEADER_ICON_BUTTON_STYLE_PROPS}
        />
      );
    }, [
      activeIndicatorValues,
      hasVisibleIndicators,
      indicators,
      indicatorsTitle,
      maxSubIndicatorCount,
      onControlInteraction,
      onIndicatorPress,
      onShowIndicatorsDialog,
      showIndicatorPopover,
    ]);

    const priceMarketCapControl = useMemo(() => {
      if (!showPriceMarketCapSelect || !priceMarketCap) {
        return null;
      }

      return (
        <PriceMarketCapSelect
          priceMarketCap={priceMarketCap}
          onPriceMarketCapModeChange={onPriceMarketCapModeChange}
          onControlInteraction={onControlInteraction}
        />
      );
    }, [
      onControlInteraction,
      onPriceMarketCapModeChange,
      priceMarketCap,
      showPriceMarketCapSelect,
    ]);

    const calendarControl =
      hasCalendarControl && onCalendarPanelSubmit ? (
        <CalendarPanelPopover
          chartTimezone={chartTimezone}
          onSubmit={onCalendarPanelSubmit}
          onControlInteraction={onControlInteraction}
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
        onPress={onSettingsPress}
        {...HEADER_ICON_BUTTON_STYLE_PROPS}
      />
    ) : null;

    const fullscreenControl = hasFullscreenControl ? (
      <IconButton
        testID="trading-view-native-fullscreen-toggle"
        size="small"
        variant="tertiary"
        icon={
          isFullscreen
            ? 'TradingViewExitFullscreenCustom'
            : 'TradingViewFullscreenCustom'
        }
        iconSize="$5"
        title={intl.formatMessage({
          id: isFullscreen
            ? ETranslations.global_collapse
            : ETranslations.global_expand,
        })}
        onPress={onFullscreenToggle}
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
            icon="UndoFlipHorOutline"
            iconSize="$5"
            title={intl.formatMessage({ id: ETranslations.menu_redo })}
            onPress={onRedo}
            {...HEADER_ICON_BUTTON_STYLE_PROPS}
          />
        </XStack>
      ) : null;

    if (
      isControlsReady &&
      !hasVisibleControls &&
      !hasCalendarControl &&
      !hasFullscreenControl &&
      !hasHistoryControls &&
      !desktopFullscreenHeader
    ) {
      return null;
    }

    const intervalSelector = hasVisibleIntervalSelector ? (
      <TradingViewNativeIntervalSelector
        intervalConfig={intervalConfig}
        intervalControlMode={intervalControlMode}
        onIntervalChange={onIntervalChange}
        onControlInteraction={onControlInteraction}
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
        <Stack
          bg="$bgApp"
          px={desktopFullscreenHeader ? '$2' : '$4'}
          py="$1"
          h={
            desktopFullscreenHeader
              ? DESKTOP_FULLSCREEN_CONTROLS_HEIGHT
              : DESKTOP_CONTROLS_HEIGHT
          }
          justifyContent="center"
          zIndex={3}
        >
          <XStack
            alignItems="center"
            width="100%"
            gap="$2"
            opacity={isControlsReady ? 1 : 0}
            pointerEvents={isControlsReady ? 'auto' : 'none'}
          >
            {desktopFullscreenHeader}

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
          opacity={isControlsReady ? 1 : 0}
          pointerEvents={isControlsReady ? 'auto' : 'none'}
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

TradingViewChartControls.displayName = 'TradingViewChartControls';
