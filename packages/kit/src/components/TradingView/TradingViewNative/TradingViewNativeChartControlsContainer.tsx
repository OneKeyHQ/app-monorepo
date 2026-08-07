import { type ReactNode, memo, useCallback } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { TradingViewChartControls } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import type { ITradingViewChartControlsProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import { getTradingViewTimezone } from '@onekeyhq/kit/src/components/TradingView/utils/tradingViewTimezone';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';

import { TradingViewMobileChartSettingsDialogContent } from './TradingViewMobileChartSettingsDialogContent';

const ACTIVE_INDICATOR_VALUES = new Set<string>();

interface ITradingViewNativeChartControlsContainerProps {
  calendarAvailableTimeRange?: ITradingViewChartControlsProps['calendarAvailableTimeRange'];
  enableNativeChartSettings?: boolean;
  intervalConfig: ITradingViewChartControlsProps['intervalConfig'];
  layoutMode?: ITradingViewChartControlsProps['layoutMode'];
  isFullscreen?: boolean;
  fullscreenHeader?: ReactNode;
  onIntervalChange: ITradingViewChartControlsProps['onIntervalChange'];
  onCalendarPanelOpen?: ITradingViewChartControlsProps['onCalendarPanelOpen'];
  onCalendarPanelSubmit?: ITradingViewChartControlsProps['onCalendarPanelSubmit'];
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export const TradingViewNativeChartControlsContainer = memo(
  ({
    calendarAvailableTimeRange,
    enableNativeChartSettings = false,
    intervalConfig,
    layoutMode = 'mobile',
    isFullscreen = false,
    fullscreenHeader,
    onIntervalChange,
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

    return (
      <TradingViewChartControls
        backgroundColor="$transparent"
        calendarAvailableTimeRange={calendarAvailableTimeRange}
        intervalConfig={intervalConfig}
        activeChartType={undefined}
        activeIndicatorValues={ACTIVE_INDICATOR_VALUES}
        chartSettingsTitle={intl.formatMessage({
          id: ETranslations.market_chart_settings,
        })}
        chartStyleTitle={chartStyleTitle}
        chartTypeToggleIcon="TradingViewCandlesOutline"
        chartTypes={[]}
        hasVisibleControls
        hasVisibleIndicators={false}
        hasVisibleIntervalSelector
        indicators={[]}
        indicatorsTitle={intl.formatMessage({
          id: ETranslations.market_indicators,
        })}
        nextChartTypeLabel={chartStyleTitle}
        priceMarketCap={undefined}
        settingsEnabled={settingsEnabled}
        showChartTypeSelect={false}
        showChartTypeToggle={false}
        showIndicatorPopover={false}
        showPriceMarketCapSelect={false}
        isControlsReady
        intervalControlMode={layoutMode === 'desktop' ? 'popover' : 'dialog'}
        layoutMode={layoutMode}
        chartTimezone={getTradingViewTimezone()}
        isFullscreen={isFullscreen}
        fullscreenHeader={fullscreenHeader}
        onIntervalChange={onIntervalChange}
        onIndicatorPress={noop}
        onShowIndicatorsDialog={noop}
        onChartTypeChange={noop}
        onChartTypeToggle={noop}
        onPriceMarketCapModeChange={noop}
        onCalendarPanelOpen={onCalendarPanelOpen}
        onCalendarPanelSubmit={onCalendarPanelSubmit}
        onSettingsPress={handleSettingsPress}
        onFullscreenToggle={
          onFullscreenChange ? handleFullscreenToggle : undefined
        }
      />
    );
  },
);

TradingViewNativeChartControlsContainer.displayName =
  'TradingViewNativeChartControlsContainer';
