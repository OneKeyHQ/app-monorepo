import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  ScrollView,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/TradingViewV2ChartControls';
import {
  useMarketDetailChartDisplayModePersistAtom,
  useMarketPriceSourceAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IStockSimpleChartRange,
  STOCK_SHARE_SIMPLE_CHART_RANGES,
  StockSimpleChart,
  TOKEN_SIMPLE_CHART_RANGES,
  resolveStockSimpleChartRangeForPriceMode,
} from '../components/StockSimpleChart';
import { useStockDetail } from '../hooks/StockDetailContext';
import { resolveDisplayedStockPriceMode } from '../hooks/useStockPriceSource';

import { MARKET_SIMPLE_CHART_RANGE_LABEL_IDS } from './components/marketSimpleChartConstants';

// Fallback when the host has no measured Pro height (web). Native hosts pass
// the Pro block height so switching modes does not move the content below.
const MOBILE_SIMPLE_CHART_HEIGHT = 280;
// The range row mirrors the Pro interval bar (TradingViewChartControls on a
// non-compact mobile layout): 8pt padding, 30pt pills, at least 42pt wide.
const RANGE_BUTTON_HEIGHT = 30;
const RANGE_BUTTON_MIN_WIDTH = 42;

const RANGE_ROW_STYLE = {
  flexGrow: 1,
  alignItems: 'center',
} as const;

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
  height,
}: {
  marketAssetId?: string;
  // Total height of the block, range row included. Matches the Pro block.
  height?: number;
}) {
  const intl = useIntl();
  const [selectedRange, setRange] = useState<IStockSimpleChartRange>('1D');
  const { stockId, isStockDetailError } = useStockDetail();
  const [{ source: priceSource }] = useMarketPriceSourceAtom();
  // Share price is what draws the previous-close line. Crypto charts, and
  // stock tokens whose share quote cannot load, stay on the token quote.
  const priceMode = resolveDisplayedStockPriceMode({
    stockId,
    isStockDetailError,
    storedPriceMode: priceSource,
  });
  const range = resolveStockSimpleChartRangeForPriceMode({
    priceMode,
    range: selectedRange,
  });
  const chartRanges =
    priceMode === 'share'
      ? STOCK_SHARE_SIMPLE_CHART_RANGES
      : TOKEN_SIMPLE_CHART_RANGES;
  const chartHeight =
    height === undefined
      ? MOBILE_SIMPLE_CHART_HEIGHT
      : Math.max(0, height - TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT);

  return (
    <YStack width="100%" testID="market-mobile-simple-chart">
      <XStack
        h={TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT}
        px="$2"
        gap="$2"
        alignItems="center"
        width="100%"
      >
        <ScrollView
          horizontal
          flex={1}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={RANGE_ROW_STYLE}
        >
          {chartRanges.map((item) => (
            <Button
              key={item}
              testID={`market-mobile-chart-range-${item}`}
              minWidth={RANGE_BUTTON_MIN_WIDTH}
              height={RANGE_BUTTON_HEIGHT}
              m="$0"
              px="$2.5"
              borderWidth={0}
              size="small"
              variant={range === item ? 'secondary' : 'tertiary'}
              borderRadius="$full"
              onPress={() => setRange(item)}
            >
              {intl.formatMessage({
                id: MARKET_SIMPLE_CHART_RANGE_LABEL_IDS[item],
              })}
            </Button>
          ))}
        </ScrollView>
        <MobileChartModeControl />
      </XStack>
      <Stack height={chartHeight} width="100%">
        <StockSimpleChart
          marketAssetId={marketAssetId}
          range={range}
          priceMode={priceMode}
          priceScaleFormat={stockId ? 'stock' : 'full'}
        />
      </Stack>
    </YStack>
  );
}

export { MobileSimpleChartFrame } from './components/MobileSimpleChartFrame';
export type { IMobileSimpleChartRange } from './components/MobileSimpleChartFrame';
