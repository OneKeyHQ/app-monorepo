import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Stack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/TradingViewV2ChartControls';
import { useMarketDetailChartDisplayModePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IStockSimpleChartRange,
  STOCK_SHARE_SIMPLE_CHART_RANGES,
  StockSimpleChart,
  TOKEN_SIMPLE_CHART_RANGES,
  resolveStockSimpleChartRangeForPriceMode,
} from '../components/StockSimpleChart';
import { useStockDetail } from '../hooks/StockDetailContext';
import { useStockPriceSource } from '../hooks/useStockPriceSource';

import { MobileSimpleChartFrame } from './components/MobileSimpleChartFrame';

// Keep Simple compact and independent of Pro's indicator panes: a 280pt plot
// plus the chart's own 28pt time axis.
export const MOBILE_SIMPLE_CHART_HEIGHT = 308;

export function ChartModeButton({
  icon,
  label,
  testID,
  onPress,
}: {
  icon: IKeyOfIcons;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Stack
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="button"
      width={32}
      height={32}
      alignItems="center"
      justifyContent="center"
      borderRadius="$full"
      bg="$transparent"
      pressStyle={{ bg: '$bgStrongActive' }}
      onPress={onPress}
    >
      <Icon name={icon} size="$4.5" color="$icon" />
    </Stack>
  );
}

export function MobileChartModeControl() {
  const intl = useIntl();
  const [{ mode }, setChartDisplayMode] =
    useMarketDetailChartDisplayModePersistAtom();
  const nextMode = mode === 'simple' ? 'pro' : 'simple';
  const handleModeChange = useCallback(() => {
    setChartDisplayMode({ mode: nextMode });
  }, [nextMode, setChartDisplayMode]);

  return (
    <ChartModeButton
      testID={`market-mobile-chart-mode-${nextMode}`}
      label={intl.formatMessage({
        id:
          nextMode === 'simple'
            ? ETranslations.market_chart_mode_simple
            : ETranslations.dexmarket_pro,
      })}
      icon={
        nextMode === 'simple'
          ? 'TradingViewLineOutline'
          : 'TradingViewCandlesOutline'
      }
      onPress={handleModeChange}
    />
  );
}

export function MobileSimpleChart({
  marketAssetId,
}: {
  marketAssetId?: string;
}) {
  const [selectedRange, setRange] = useState<IStockSimpleChartRange>('1D');
  const { stockId } = useStockDetail();
  const { priceMode } = useStockPriceSource();
  const range = resolveStockSimpleChartRangeForPriceMode({
    priceMode,
    range: selectedRange,
  });
  const chartRanges =
    priceMode === 'share'
      ? STOCK_SHARE_SIMPLE_CHART_RANGES
      : TOKEN_SIMPLE_CHART_RANGES;

  return (
    <MobileSimpleChartFrame
      height={
        MOBILE_SIMPLE_CHART_HEIGHT + TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT
      }
      range={range}
      onRangeChange={setRange}
      chartRanges={chartRanges}
      controlsPaddingHorizontal="$2"
      modeControl={<MobileChartModeControl />}
    >
      <StockSimpleChart
        initialHeight={MOBILE_SIMPLE_CHART_HEIGHT}
        marketAssetId={marketAssetId}
        range={range}
        priceMode={priceMode}
        priceScaleFormat={stockId ? 'stock' : 'full'}
      />
    </MobileSimpleChartFrame>
  );
}

export { MobileSimpleChartFrame } from './components/MobileSimpleChartFrame';
export type { IMobileSimpleChartRange } from './components/MobileSimpleChartFrame';
