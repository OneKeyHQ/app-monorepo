import { memo } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { TradingViewChartControls } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import type { ITradingViewChartControlsProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const INTERVAL_CONFIG: ITradingViewChartControlsProps['intervalConfig'] = {
  intervals: [
    { label: '1m', value: '1' },
    { label: '15m', value: '15' },
    { label: '1H', value: '60' },
    { label: '4H', value: '240' },
  ],
  activeInterval: '60',
};
const ACTIVE_INDICATOR_VALUES = new Set<string>();

interface ITradingViewNativeChartControlsContainerProps {
  layoutMode?: ITradingViewChartControlsProps['layoutMode'];
}

export const TradingViewNativeChartControlsContainer = memo(
  ({
    layoutMode = 'mobile',
  }: ITradingViewNativeChartControlsContainerProps) => {
    const intl = useIntl();
    const chartStyleTitle = intl.formatMessage({
      id: ETranslations.market_chart_style,
    });

    return (
      <TradingViewChartControls
        intervalConfig={INTERVAL_CONFIG}
        activeChartType={undefined}
        activeIndicatorValues={ACTIVE_INDICATOR_VALUES}
        chartSettingsTitle={intl.formatMessage({
          id: ETranslations.market_chart_settings,
        })}
        chartStyleTitle={chartStyleTitle}
        chartTypeToggleIcon="TradingViewCandlesOutline"
        chartTypes={[]}
        hasVisibleControls
        hasVisibleIndicators
        hasVisibleIntervalSelector
        indicators={[]}
        indicatorsTitle={intl.formatMessage({
          id: ETranslations.market_indicators,
        })}
        nextChartTypeLabel={chartStyleTitle}
        priceMarketCap={undefined}
        settingsEnabled
        showChartTypeSelect={false}
        showChartTypeToggle
        showIndicatorPopover={false}
        showPriceMarketCapSelect={false}
        isControlsReady
        intervalControlMode="dialog"
        layoutMode={layoutMode}
        chartTimezone="UTC"
        isFullscreen={false}
        onIntervalChange={noop}
        onIndicatorPress={noop}
        onShowIndicatorsDialog={noop}
        onChartTypeChange={noop}
        onChartTypeToggle={noop}
        onPriceMarketCapModeChange={noop}
        onSettingsPress={noop}
      />
    );
  },
);

TradingViewNativeChartControlsContainer.displayName =
  'TradingViewNativeChartControlsContainer';
