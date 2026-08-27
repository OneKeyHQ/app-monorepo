import { type ComponentProps, type ReactNode, memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  ScrollView,
  Select,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
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
type ITradingViewChartMode = 'native' | 'tradingView';

export interface ITradingViewChartControlsProps {
  backgroundColor?: ComponentProps<typeof Stack>['backgroundColor'];
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
  maxSelectableSubIndicatorCount?: number;
  isControlsReady: boolean;
  intervalControlMode: ITradingViewNativeIntervalControlMode;
  layoutMode: ITradingViewNativeControlsLayoutMode;
  // Drops the desktop row's own horizontal inset so its first control lines up
  // with the plot's leading edge. Only assemblies that lay the row directly on
  // the chart want this; the standalone chart keeps the inset.
  flushDesktopControls?: boolean;
  chartTimezone: string;
  calendarAvailableTimeRange?: ICalendarPanelAvailableTimeRange;
  isFullscreen: boolean;
  fullscreenHeader?: ReactNode;
  chartMode?: ITradingViewChartMode;
  isChartSwitchDisabled?: boolean;
  onChartSwitch?: () => void;
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
    maxSelectableSubIndicatorCount,
    isControlsReady,
    intervalControlMode,
    layoutMode,
    flushDesktopControls,
    chartTimezone,
    calendarAvailableTimeRange,
    isFullscreen,
    fullscreenHeader,
    chartMode,
    isChartSwitchDisabled = false,
    onChartSwitch,
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
    let desktopControlsPaddingX = '$4';
    if (desktopFullscreenHeader) {
      desktopControlsPaddingX = '$2';
    } else if (flushDesktopControls) {
      desktopControlsPaddingX = '$0';
    }

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
            maxSelectableSubIndicatorCount={maxSelectableSubIndicatorCount}
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
      maxSelectableSubIndicatorCount,
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

    const chartModeItems = [
      {
        label: 'Original',
        value: 'native' as const,
      },
      {
        label: 'TradingView',
        value: 'tradingView' as const,
      },
    ];
    const selectedChartModeLabel = chartModeItems.find(
      (item) => item.value === chartMode,
    )?.label;
    const chartSwitchControl =
      chartMode && onChartSwitch ? (
        <Select
          testID="trading-view-chart-switch"
          title={intl.formatMessage({ id: ETranslations.market_chart })}
          items={chartModeItems}
          value={chartMode}
          disabled={isChartSwitchDisabled}
          onChange={(nextChartMode) => {
            if (
              !isChartSwitchDisabled &&
              (nextChartMode === 'native' || nextChartMode === 'tradingView') &&
              nextChartMode !== chartMode
            ) {
              onChartSwitch();
            }
          }}
          placement="bottom-end"
          floatingPanelProps={{ width: 180 }}
          renderTrigger={({ onPress, disabled }) => (
            <XStack
              testID="trading-view-chart-switch-trigger"
              h={30}
              px="$3"
              gap="$1.5"
              alignItems="center"
              borderRadius="$full"
              borderCurve="continuous"
              bg="$transparent"
              opacity={disabled ? 0.5 : 1}
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
              cursor={disabled ? 'not-allowed' : 'pointer'}
              userSelect="none"
              onPress={(event) => {
                if (disabled) {
                  return;
                }
                onControlInteraction?.();
                onPress?.(event);
              }}
            >
              <SizableText
                size="$bodyMdMedium"
                color="$textSubdued"
                numberOfLines={1}
              >
                {selectedChartModeLabel}
              </SizableText>
              <Icon
                name="ChevronDownSmallOutline"
                size="$4"
                color="$iconSubdued"
              />
            </XStack>
          )}
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
      !chartSwitchControl &&
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
          bg={backgroundColor}
          px={desktopControlsPaddingX}
          py="$1"
          h={
            desktopFullscreenHeader
              ? DESKTOP_FULLSCREEN_CONTROLS_HEIGHT
              : DESKTOP_CONTROLS_HEIGHT
          }
          justifyContent="center"
          zIndex={3}
        >
          <XStack alignItems="center" width="100%" gap="$2">
            {desktopFullscreenHeader}

            <XStack
              testID="trading-view-chart-ready-controls"
              flex={1}
              minWidth={0}
              gap="$2"
              alignItems="center"
              opacity={isControlsReady ? 1 : 0}
              pointerEvents={isControlsReady ? 'auto' : 'none'}
            >
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

                  {(intervalSelector || hasLeftChartTools) &&
                  undoRedoControls ? (
                    <ToolbarSeparator />
                  ) : null}

                  {undoRedoControls}
                </XStack>
              </ScrollView>

              {priceMarketCapControl}

              {priceMarketCapControl &&
              (chartSwitchControl || fullscreenControl) ? (
                <ToolbarSeparator />
              ) : null}
            </XStack>

            <XStack gap="$2" alignItems="center" flexShrink={0}>
              {chartSwitchControl}

              {chartSwitchControl && fullscreenControl ? (
                <ToolbarSeparator />
              ) : null}

              {fullscreenControl}
            </XStack>
          </XStack>
        </Stack>
      );
    }

    return (
      <Stack bg={backgroundColor} px="$2" py="$2" zIndex={3}>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          width="100%"
          gap="$2"
        >
          <XStack
            testID="trading-view-chart-ready-controls"
            flex={1}
            minWidth={0}
            gap="$2"
            alignItems="center"
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
            </XStack>
          </XStack>

          <XStack gap="$2" alignItems="center" justifyContent="flex-end">
            {chartSwitchControl}
            {fullscreenControl}
          </XStack>
        </XStack>
      </Stack>
    );
  },
);

TradingViewChartControls.displayName = 'TradingViewChartControls';
