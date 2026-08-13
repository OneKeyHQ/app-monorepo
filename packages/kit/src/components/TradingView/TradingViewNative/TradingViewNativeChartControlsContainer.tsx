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
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import { getTradingViewTimezone } from '@onekeyhq/kit/src/components/TradingView/utils/tradingViewTimezone';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';

import { TradingViewMobileChartSettingsDialogContent } from './TradingViewMobileChartSettingsDialogContent';
import {
  type ITradingViewNativeIndicator,
  TRADING_VIEW_NATIVE_INDICATORS,
  isTradingViewNativeIndicator,
} from './utils/chartIndicators';

interface ITradingViewNativeChartControlsContainerProps {
  activeIndicatorValues: Set<string>;
  calendarAvailableTimeRange?: ITradingViewChartControlsProps['calendarAvailableTimeRange'];
  enableNativeChartSettings?: boolean;
  intervalConfig: ITradingViewChartControlsProps['intervalConfig'];
  layoutMode?: ITradingViewChartControlsProps['layoutMode'];
  isFullscreen?: boolean;
  fullscreenHeader?: ReactNode;
  onIntervalChange: ITradingViewChartControlsProps['onIntervalChange'];
  onChartClose?: () => void;
  onIndicatorChange: (
    indicator: ITradingViewNativeIndicator,
    desiredActive: boolean,
  ) => void;
  onCalendarPanelOpen?: ITradingViewChartControlsProps['onCalendarPanelOpen'];
  onCalendarPanelSubmit?: ITradingViewChartControlsProps['onCalendarPanelSubmit'];
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export const TradingViewNativeChartControlsContainer = memo(
  ({
    activeIndicatorValues,
    calendarAvailableTimeRange,
    enableNativeChartSettings = false,
    intervalConfig,
    layoutMode = 'mobile',
    isFullscreen = false,
    fullscreenHeader,
    onIntervalChange,
    onChartClose,
    onIndicatorChange,
    onCalendarPanelOpen,
    onCalendarPanelSubmit,
    onFullscreenChange,
  }: ITradingViewNativeChartControlsContainerProps) => {
    const intl = useIntl();
    const navigation = useAppNavigation();
    const chartStyleTitle = intl.formatMessage({
      id: ETranslations.market_chart_style,
    });
    const settingsEnabled = enableNativeChartSettings;
    const indicators = useMemo<ITradingViewIndicatorOption[]>(
      () =>
        TRADING_VIEW_NATIVE_INDICATORS.map((indicator) => ({
          active: activeIndicatorValues.has(indicator),
          label: indicator,
          value: indicator,
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
    const handleSettingsPress = useCallback(() => {
      if (layoutMode !== 'mobile') {
        openChartSettingsModal();
        return;
      }

      Dialog.show({
        title: intl.formatMessage({ id: ETranslations.global_settings }),
        showFooter: false,
        testID: 'trading-view-native-chart-settings-quick-dialog',
        renderContent: (
          <TradingViewMobileChartSettingsDialogContent
            onOpenSettings={openChartSettingsModal}
          />
        ),
      });
    }, [intl, layoutMode, openChartSettingsModal]);
    const handleFullscreenToggle = useCallback(() => {
      onFullscreenChange?.(!isFullscreen);
    }, [isFullscreen, onFullscreenChange]);
    const handleIndicatorPress = useCallback(
      (indicator: ITradingViewIndicatorOption) => {
        if (!isTradingViewNativeIndicator(indicator.value)) {
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
        if (isTradingViewNativeIndicator(indicatorName)) {
          onIndicatorChange(indicatorName, desiredActive);
        }
      },
      [onIndicatorChange],
    );
    const showIndicatorsDialog = useCallback(() => {
      Dialog.show({
        title: indicatorsTitle,
        showFooter: false,
        testID: 'trading-view-native-indicators-dialog',
        renderContent: (
          <IndicatorListDialogContent
            indicators={indicators}
            onSelect={handleIndicatorSelect}
            onResetLayout={noop}
          />
        ),
      });
    }, [handleIndicatorSelect, indicators, indicatorsTitle]);
    const closeControl = onChartClose ? (
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    ) : null;
    const closeLabel = intl.formatMessage({ id: ETranslations.global_close });

    return (
      <TradingViewChartControls
        backgroundColor="$transparent"
        calendarAvailableTimeRange={calendarAvailableTimeRange}
        intervalConfig={intervalConfig}
        activeChartType={undefined}
        activeIndicatorValues={activeIndicatorValues}
        chartSettingsTitle={intl.formatMessage({
          id: ETranslations.market_chart_settings,
        })}
        chartStyleTitle={chartStyleTitle}
        chartTypeToggleIcon="TradingViewCandlesOutline"
        chartTypes={[]}
        hasVisibleControls
        hasVisibleIndicators={!onChartClose}
        hasVisibleIntervalSelector
        indicators={indicators}
        indicatorsTitle={indicatorsTitle}
        nextChartTypeLabel={chartStyleTitle}
        priceMarketCap={undefined}
        settingsEnabled={settingsEnabled}
        showChartTypeSelect={false}
        showChartTypeToggle={false}
        showIndicatorPopover={layoutMode === 'desktop'}
        showPriceMarketCapSelect={false}
        isControlsReady
        intervalControlMode={layoutMode === 'desktop' ? 'popover' : 'dialog'}
        layoutMode={layoutMode}
        chartTimezone={getTradingViewTimezone()}
        isFullscreen={isFullscreen}
        fullscreenHeader={fullscreenHeader}
        rightControl={closeControl}
        rightControlLabel={onChartClose ? closeLabel : undefined}
        onIntervalChange={onIntervalChange}
        onIndicatorPress={handleIndicatorPress}
        onShowIndicatorsDialog={showIndicatorsDialog}
        onChartTypeChange={noop}
        onChartTypeToggle={noop}
        onPriceMarketCapModeChange={noop}
        onCalendarPanelOpen={onCalendarPanelOpen}
        onCalendarPanelSubmit={onCalendarPanelSubmit}
        onSettingsPress={handleSettingsPress}
        onFullscreenToggle={
          onFullscreenChange ? handleFullscreenToggle : undefined
        }
        onRightControlPress={onChartClose}
      />
    );
  },
);

TradingViewNativeChartControlsContainer.displayName =
  'TradingViewNativeChartControlsContainer';
