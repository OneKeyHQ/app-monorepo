import { memo } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { TradingViewChartControls } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import type { ITradingViewChartControlsProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const ACTIVE_INDICATOR_VALUES = new Set<string>();

interface ITradingViewNativeChartControlsContainerProps {
  intervalConfig: ITradingViewChartControlsProps['intervalConfig'];
  layoutMode?: ITradingViewChartControlsProps['layoutMode'];
  onIntervalChange: ITradingViewChartControlsProps['onIntervalChange'];
}

export const TradingViewNativeChartControlsContainer = memo(
  ({
    intervalConfig,
    layoutMode = 'mobile',
    onIntervalChange,
  }: ITradingViewNativeChartControlsContainerProps) => {
    const intl = useIntl();
    const chartStyleTitle = intl.formatMessage({
      id: ETranslations.market_chart_style,
    });

    return (
      <TradingViewChartControls
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
        settingsEnabled={false}
        showChartTypeSelect={false}
        showChartTypeToggle={false}
        showIndicatorPopover={false}
        showPriceMarketCapSelect={false}
        isControlsReady
        intervalControlMode={layoutMode === 'desktop' ? 'popover' : 'dialog'}
        layoutMode={layoutMode}
        chartTimezone="UTC"
        isFullscreen={false}
        onIntervalChange={onIntervalChange}
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
