import { useCallback } from 'react';

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
import { useMarketDetailChartDisplayModePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useMarketDetailChartAnalytics } from '../../utils/marketDetailAnalytics';
import {
  STOCK_SHARE_SIMPLE_CHART_RANGES,
  StockSimpleChart,
  StockSimpleChartTimeRangeSelect,
  TOKEN_SIMPLE_CHART_RANGES,
  useStockSimpleChartSelection,
} from '../components/StockSimpleChart';
import { useStockDetail } from '../hooks/StockDetailContext';
import { useStockPriceSource } from '../hooks/useStockPriceSource';

import { MARKET_SIMPLE_CHART_RANGE_LABEL_IDS } from './components/marketSimpleChartConstants';

// Keep Simple compact and independent of Pro's indicator panes: a 280pt plot
// plus the chart's own 28pt time axis.
export const MOBILE_SIMPLE_CHART_HEIGHT = 308;
// The range row follows the Pro interval bar's 30pt pills, packed tighter
// (8pt side padding, at least 36pt wide) so the time-range capsule and the
// range buttons fit one row without scrolling.
const RANGE_BUTTON_HEIGHT = 30;
const RANGE_BUTTON_MIN_WIDTH = 36;

const RANGE_ROW_STYLE = {
  flexGrow: 1,
  alignItems: 'center',
} as const;

function ChartModeButton({
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
  const chartAnalytics = useMarketDetailChartAnalytics();
  const nextMode = mode === 'simple' ? 'pro' : 'simple';
  const handleModeChange = useCallback(() => {
    setChartDisplayMode({ mode: nextMode });
    chartAnalytics?.onChartDisplayModeSwitch(mode, nextMode);
  }, [chartAnalytics, mode, nextMode, setChartDisplayMode]);

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
  const intl = useIntl();
  const { stockDetail, stockId } = useStockDetail();
  const { priceMode } = useStockPriceSource();
  const chartAnalytics = useMarketDetailChartAnalytics();
  const {
    range,
    session,
    capsuleSession,
    selectedRange,
    selectRange,
    selectSession,
  } = useStockSimpleChartSelection(
    priceMode,
    stockDetail?.marketStatus?.session,
  );
  const chartRanges =
    priceMode === 'share'
      ? STOCK_SHARE_SIMPLE_CHART_RANGES
      : TOKEN_SIMPLE_CHART_RANGES;

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
          {priceMode === 'share' ? (
            <StockSimpleChartTimeRangeSelect
              testID="market-mobile-chart-time-range"
              height={RANGE_BUTTON_HEIGHT}
              activateOnPress
              capsuleSession={capsuleSession}
              session={session}
              onSessionChange={selectSession}
            />
          ) : null}
          {chartRanges.map((item) => (
            <Button
              key={item}
              testID={`market-mobile-chart-range-${item}`}
              minWidth={RANGE_BUTTON_MIN_WIDTH}
              height={RANGE_BUTTON_HEIGHT}
              m="$0"
              px="$2"
              borderWidth={0}
              size="small"
              variant={selectedRange === item ? 'secondary' : 'tertiary'}
              borderRadius="$full"
              onPress={() => {
                selectRange(item);
                chartAnalytics?.onSimpleChartRangeSelect(range, item);
              }}
            >
              {intl.formatMessage({
                id: MARKET_SIMPLE_CHART_RANGE_LABEL_IDS[item],
              })}
            </Button>
          ))}
        </ScrollView>
        <MobileChartModeControl />
      </XStack>
      <Stack height={MOBILE_SIMPLE_CHART_HEIGHT} width="100%">
        <StockSimpleChart
          initialHeight={MOBILE_SIMPLE_CHART_HEIGHT}
          marketAssetId={marketAssetId}
          range={range}
          session={session}
          priceMode={priceMode}
          priceScaleFormat={stockId ? 'stock' : 'full'}
        />
      </Stack>
    </YStack>
  );
}
