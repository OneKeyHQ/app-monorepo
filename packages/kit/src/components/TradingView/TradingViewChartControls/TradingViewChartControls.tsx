import { type ComponentProps, type ReactNode, memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { IconButton, ScrollView, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { CalendarPanelPopover } from './calendarControls/CalendarPanelPopover';
import { ChartTypeSelect } from './chartType/ChartTypeSelect';
import { IndicatorPopover } from './indicatorSelector/NativeIndicatorSelector';
import { TradingViewNativeIntervalSelector } from './intervalSelector/NativeIntervalSelector';
import { PriceMarketCapSelect } from './priceMarketCap/PriceMarketCapSelect';
import { HEADER_ICON_BUTTON_STYLE_PROPS } from './utils/NativeChartControlsShared';

import type {
  ICalendarPanelAvailableTimeRange,
  ICalendarPanelSubmitPayload,
} from './calendarControls/CalendarPanelPopover';
import type { ITradingViewNativeIntervalControlMode } from './intervalSelector/NativeIntervalSelector';
import type {
  ITradingViewChartTypeOption,
  ITradingViewIndicatorOption,
  ITradingViewIntervalConfigData,
  ITradingViewNativeChartControlsConfigData,
  ITradingViewNativeControlsLayoutMode,
  ITradingViewPriceMarketCapMode,
} from './types';

type IPriceMarketCapConfig =
  ITradingViewNativeChartControlsConfigData['priceMarketCap'];

export interface ITradingViewChartControlsProps {
  backgroundColor?: ComponentProps<typeof Stack>['backgroundColor'];
  compactMobileLayout?: boolean;
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
  calendarAvailableTimeRange?: ICalendarPanelAvailableTimeRange;
  isFullscreen: boolean;
  fullscreenHeader?: ReactNode;
  rightControl?: ReactNode;
  rightControlLabel?: string;
  onIntervalChange: (interval: string) => void;
  onIndicatorPress: (indicator: ITradingViewIndicatorOption) => void;
  onShowIndicatorsDialog: () => void;
  onChartTypeChange: (chartType: number) => void;
  onChartTypeToggle: () => void;
  onPriceMarketCapModeChange: (mode: ITradingViewPriceMarketCapMode) => void;
  onCalendarPanelOpen?: () => void;
  onCalendarPanelSubmit?: (payload: ICalendarPanelSubmitPayload) => void;
  onSettingsPress: () => void;
  onControlInteraction?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onFullscreenToggle?: () => void;
  onRightControlPress?: () => void;
}

function ToolbarSeparator() {
  return <Stack h="$6" w="$px" bg="$borderSubdued" flexShrink={0} />;
}

const DESKTOP_CONTROLS_HEIGHT = 38;
const DESKTOP_FULLSCREEN_CONTROLS_HEIGHT = 64;
export const TRADING_VIEW_CHART_CONTROLS_HEIGHT = 48;

export const TradingViewChartControls = memo(
  ({
    backgroundColor = '$bgApp',
    compactMobileLayout = false,
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
    calendarAvailableTimeRange,
    isFullscreen,
    fullscreenHeader,
    rightControl,
    rightControlLabel,
    onIntervalChange,
    onIndicatorPress,
    onShowIndicatorsDialog,
    onChartTypeChange,
    onChartTypeToggle,
    onPriceMarketCapModeChange,
    onCalendarPanelOpen,
    onCalendarPanelSubmit,
    onSettingsPress,
    onControlInteraction,
    onUndo,
    onRedo,
    onFullscreenToggle,
    onRightControlPress,
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
          availableTimeRange={calendarAvailableTimeRange}
          chartTimezone={chartTimezone}
          onOpen={onCalendarPanelOpen}
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
      !rightControl &&
      !desktopFullscreenHeader
    ) {
      return null;
    }

    const intervalSelector = hasVisibleIntervalSelector ? (
      <TradingViewNativeIntervalSelector
        compactMobileLayout={compactMobileLayout}
        intervalConfig={intervalConfig}
        intervalControlMode={intervalControlMode}
        showActiveBackground={isDesktopLayout || !compactMobileLayout}
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
          bg={backgroundColor}
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
              {rightControl}
            </XStack>
          </XStack>
        </Stack>
      );
    }

    return (
      <Stack
        bg={backgroundColor}
        px="$2"
        py={compactMobileLayout ? undefined : '$2'}
        pt={compactMobileLayout ? '$1.5' : undefined}
        pb={compactMobileLayout ? '$0.5' : undefined}
        borderBottomWidth={compactMobileLayout ? 0.5 : 0}
        borderBottomColor="$borderSubdued"
        zIndex={3}
      >
        <XStack
          alignItems="center"
          justifyContent="space-between"
          width="100%"
          gap="$2"
          opacity={isControlsReady ? 1 : 0}
          pointerEvents={isControlsReady ? 'auto' : 'none'}
        >
          <XStack
            flex={onRightControlPress ? undefined : 1}
            minWidth={0}
            alignItems="center"
          >
            {intervalSelector}
          </XStack>

          <XStack
            testID={
              onRightControlPress
                ? 'trading-view-native-chart-close'
                : undefined
            }
            flex={onRightControlPress ? 1 : undefined}
            alignSelf={onRightControlPress ? 'stretch' : undefined}
            gap="$2"
            alignItems="center"
            justifyContent="flex-end"
            accessibilityRole={onRightControlPress ? 'button' : undefined}
            accessibilityLabel={rightControlLabel}
            cursor={onRightControlPress ? 'pointer' : undefined}
            onPress={onRightControlPress}
          >
            {chartTypeControl}
            {priceMarketCapControl}
            {indicatorControl}
            {calendarControl}
            {settingsControl}
            {fullscreenControl}
            {rightControl}
          </XStack>
        </XStack>
      </Stack>
    );
  },
);

TradingViewChartControls.displayName = 'TradingViewChartControls';
