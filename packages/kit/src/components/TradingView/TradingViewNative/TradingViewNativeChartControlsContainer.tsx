import { type ReactNode, memo, useCallback } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { TradingViewChartControls } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import type { ITradingViewChartControlsProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import { showTradingViewChartSettingsDialog } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings';
import { getTradingViewTimezone } from '@onekeyhq/kit/src/components/TradingView/utils/tradingViewTimezone';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
    const chartStyleTitle = intl.formatMessage({
      id: ETranslations.market_chart_style,
    });
    const settingsEnabled =
      enableNativeChartSettings && layoutMode === 'desktop';
    const handleSettingsPress = useCallback(() => {
      showTradingViewChartSettingsDialog();
    }, []);
    const handleFullscreenToggle = useCallback(() => {
      onFullscreenChange?.(!isFullscreen);
    }, [isFullscreen, onFullscreenChange]);

    return (
      <TradingViewChartControls
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
