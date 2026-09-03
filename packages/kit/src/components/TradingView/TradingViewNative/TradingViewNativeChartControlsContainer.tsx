import { type ReactNode, memo, useCallback, useMemo } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { Dialog, Icon } from '@onekeyhq/components';
import {
  IndicatorListDialogContent,
  TradingViewChartControls,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import type {
  ITradingViewChartControlsProps,
  ITradingViewIndicatorOption,
  ITradingViewNativeIndicatorSelection,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import { getTradingViewTimezone } from '@onekeyhq/kit/src/components/TradingView/utils/tradingViewTimezone';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';

import {
  type ITradingViewNativeAnyIndicator,
  TRADING_VIEW_NATIVE_INDICATOR_CATALOG,
  isTradingViewNativeAnyIndicator,
} from './utils/chartIndicators/indicatorCatalog';
import {
  TRADING_VIEW_NATIVE_CHART_TYPE_OPTIONS,
  getTradingViewNativeChartTypeFromValue,
  getTradingViewNativeChartTypeValue,
} from './utils/chartType';

import type { ITradingViewNativeChartType } from './types';

interface ITradingViewNativeChartControlsContainerProps {
  activeChartType: ITradingViewNativeChartType;
  activeIndicatorValues: Set<string>;
  calendarAvailableTimeRange?: ITradingViewChartControlsProps['calendarAvailableTimeRange'];
  compactMobileLayout?: boolean;
  enableNativeChartSettings?: boolean;
  intervalConfig: ITradingViewChartControlsProps['intervalConfig'];
  maxSelectableSubIndicatorCount?: number;
  layoutMode?: ITradingViewChartControlsProps['layoutMode'];
  flushDesktopControls?: ITradingViewChartControlsProps['flushDesktopControls'];
  showChartCloseControl?: boolean;
  isFullscreen?: boolean;
  fullscreenHeader?: ReactNode;
  isChartSwitchDisabled?: ITradingViewChartControlsProps['isChartSwitchDisabled'];
  onChartSwitch?: ITradingViewChartControlsProps['onChartSwitch'];
  onChartTypeChange: (chartType: ITradingViewNativeChartType) => void;
  onIntervalChange: ITradingViewChartControlsProps['onIntervalChange'];
  onChartClose?: () => void;
  onIndicatorChange: (
    indicator: ITradingViewNativeAnyIndicator,
    desiredActive: boolean,
  ) => void;
  onIndicatorSettingsPress: () => void;
  onIndicatorSelectionConfirm: (
    selection: ITradingViewNativeIndicatorSelection,
  ) => void;
  onCalendarPanelOpen?: ITradingViewChartControlsProps['onCalendarPanelOpen'];
  onCalendarPanelSubmit?: ITradingViewChartControlsProps['onCalendarPanelSubmit'];
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export const TradingViewNativeChartControlsContainer = memo(
  ({
    activeChartType,
    activeIndicatorValues,
    calendarAvailableTimeRange,
    compactMobileLayout = false,
    enableNativeChartSettings = false,
    intervalConfig,
    maxSelectableSubIndicatorCount,
    layoutMode = 'mobile',
    flushDesktopControls,
    showChartCloseControl = true,
    isFullscreen = false,
    fullscreenHeader,
    isChartSwitchDisabled,
    onChartSwitch,
    onChartTypeChange,
    onIntervalChange,
    onChartClose,
    onIndicatorChange,
    onIndicatorSettingsPress,
    onIndicatorSelectionConfirm,
    onCalendarPanelOpen,
    onCalendarPanelSubmit,
    onFullscreenChange,
  }: ITradingViewNativeChartControlsContainerProps) => {
    const intl = useIntl();
    const navigation = useAppNavigation();
    const chartStyleTitle = intl.formatMessage({
      id: ETranslations.market_chart_style,
    });
    const activeChartTypeValue =
      getTradingViewNativeChartTypeValue(activeChartType);
    const settingsEnabled =
      enableNativeChartSettings && layoutMode === 'desktop';
    const indicators = useMemo<ITradingViewIndicatorOption[]>(
      () =>
        TRADING_VIEW_NATIVE_INDICATOR_CATALOG.map(({ id, label }) => ({
          active: activeIndicatorValues.has(id),
          label,
          value: id,
        })),
      [activeIndicatorValues],
    );
    const indicatorsTitle = intl.formatMessage({
      id: ETranslations.market_indicators,
    });
    const openChartSettingsModal = useCallback(() => {
      navigation.pushModal(EModalRoutes.MarketModal, {
        screen: EModalMarketRoutes.MarketChartSettings,
      });
    }, [navigation]);
    const handleFullscreenToggle = useCallback(() => {
      onFullscreenChange?.(!isFullscreen);
    }, [isFullscreen, onFullscreenChange]);
    const handleChartTypeChange = useCallback(
      (chartTypeValue: number) => {
        const nextChartType =
          getTradingViewNativeChartTypeFromValue(chartTypeValue);
        if (nextChartType && nextChartType !== activeChartType) {
          onChartTypeChange(nextChartType);
        }
      },
      [activeChartType, onChartTypeChange],
    );
    const handleIndicatorPress = useCallback(
      (indicator: ITradingViewIndicatorOption) => {
        if (!isTradingViewNativeAnyIndicator(indicator.value)) {
          return;
        }
        onIndicatorChange(
          indicator.value,
          !activeIndicatorValues.has(indicator.value),
        );
      },
      [activeIndicatorValues, onIndicatorChange],
    );
    const handleIndicatorSelect = useCallback(
      (indicatorName: string, desiredActive: boolean) => {
        if (isTradingViewNativeAnyIndicator(indicatorName)) {
          onIndicatorChange(indicatorName, desiredActive);
        }
      },
      [onIndicatorChange],
    );
    const showIndicatorsDialog = useCallback(() => {
      if (layoutMode === 'desktop') {
        onIndicatorSettingsPress();
        return;
      }

      Dialog.show({
        title: indicatorsTitle,
        showFooter: false,
        testID: 'trading-view-native-indicators-dialog',
        renderContent: (
          <IndicatorListDialogContent
            indicators={indicators}
            maxSelectableSubIndicatorCount={maxSelectableSubIndicatorCount}
            onSelect={handleIndicatorSelect}
            onSelectionConfirm={onIndicatorSelectionConfirm}
            onResetLayout={noop}
          />
        ),
      });
    }, [
      handleIndicatorSelect,
      indicators,
      indicatorsTitle,
      layoutMode,
      maxSelectableSubIndicatorCount,
      onIndicatorSettingsPress,
      onIndicatorSelectionConfirm,
    ]);
    const shouldShowChartCloseControl =
      Boolean(onChartClose) && showChartCloseControl;
    const closeControl = shouldShowChartCloseControl ? (
      <Icon
        name="ChevronTriangleDownSmallSolid"
        size="$5"
        color="$iconSubdued"
      />
    ) : null;
    const closeLabel = intl.formatMessage({ id: ETranslations.global_close });

    return (
      <TradingViewChartControls
        backgroundColor="$transparent"
        calendarAvailableTimeRange={calendarAvailableTimeRange}
        compactMobileLayout={compactMobileLayout}
        intervalConfig={intervalConfig}
        activeChartType={activeChartTypeValue}
        activeIndicatorValues={activeIndicatorValues}
        chartSettingsTitle={intl.formatMessage({
          id: ETranslations.market_chart_settings,
        })}
        chartStyleTitle={chartStyleTitle}
        chartTypeToggleIcon="TradingViewCandlesOutline"
        chartTypes={TRADING_VIEW_NATIVE_CHART_TYPE_OPTIONS}
        hasVisibleControls
        hasVisibleIndicators={!onChartClose}
        hasVisibleIntervalSelector
        indicators={indicators}
        indicatorsTitle={indicatorsTitle}
        maxSelectableSubIndicatorCount={maxSelectableSubIndicatorCount}
        nextChartTypeLabel={chartStyleTitle}
        priceMarketCap={undefined}
        settingsEnabled={settingsEnabled}
        showChartTypeSelect={!compactMobileLayout}
        showChartTypeToggle={false}
        showIndicatorPopover={false}
        showPriceMarketCapSelect={false}
        isControlsReady
        intervalControlMode={layoutMode === 'desktop' ? 'popover' : 'dialog'}
        layoutMode={layoutMode}
        flushDesktopControls={flushDesktopControls}
        chartTimezone={getTradingViewTimezone()}
        isFullscreen={isFullscreen}
        fullscreenHeader={fullscreenHeader}
        chartMode={layoutMode === 'desktop' ? 'native' : undefined}
        isChartSwitchDisabled={isChartSwitchDisabled}
        onChartSwitch={layoutMode === 'desktop' ? onChartSwitch : undefined}
        rightControl={closeControl}
        rightControlLabel={shouldShowChartCloseControl ? closeLabel : undefined}
        onIntervalChange={onIntervalChange}
        onIndicatorPress={handleIndicatorPress}
        onShowIndicatorsDialog={showIndicatorsDialog}
        onChartTypeChange={handleChartTypeChange}
        onChartTypeToggle={noop}
        onPriceMarketCapModeChange={noop}
        onCalendarPanelOpen={onCalendarPanelOpen}
        onCalendarPanelSubmit={onCalendarPanelSubmit}
        onSettingsPress={openChartSettingsModal}
        onFullscreenToggle={
          onFullscreenChange ? handleFullscreenToggle : undefined
        }
        onRightControlPress={
          shouldShowChartCloseControl ? onChartClose : undefined
        }
      />
    );
  },
);

TradingViewNativeChartControlsContainer.displayName =
  'TradingViewNativeChartControlsContainer';
