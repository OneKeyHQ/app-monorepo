import { useMemo, useState } from 'react';

import { SizableText, Stack, Switch, XStack } from '@onekeyhq/components';
import { useTradingViewSettingsThemeColors } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings/TradingViewSettingsThemeColors';
import { TRADING_VIEW_NATIVE_PRICE_AXIS_FONT_SIZE } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/chartConstants';
import { TradingViewNativeChart } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/TradingViewNativeChart';
import type { ITradingViewNativeChartProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/TradingViewNativeChart.types';
import type {
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativeTradeMark,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/types';
import { resolveTradingViewNativeChartThemeColors } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/utils/chartThemeColors';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import { createTradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

const CANDLE_INTERVAL_SECONDS = 15 * 60;
const START_TIME = Date.UTC(2026, 9, 22) / 1000;
const DEFAULT_SETTINGS = createTradingViewNativeChartSettings();
const EMPTY_COMPONENTS: ITradingViewNativeChartLeafComponent[] = [];

function getMockPrice(index: number) {
  return (
    100 +
    index * 0.12 +
    Math.sin(index / 5) * 3 +
    Math.cos(index / 13) * 2 +
    Math.sin(index * 1.7) * 0.6
  );
}

const MOCK_POINTS: IMarketTokenKLineDataPoint[] = Array.from(
  { length: 96 },
  (_, index) => {
    const open = getMockPrice(index - 1);
    const close = getMockPrice(index);
    return {
      o: open,
      c: close,
      h: Math.max(open, close) + 0.4 + (index % 3) * 0.15,
      l: Math.min(open, close) - 0.3 - (index % 4) * 0.1,
      v: 1200 + ((index * 173) % 2800),
      t: START_TIME + index * CANDLE_INTERVAL_SECONDS,
    };
  },
);

const MOCK_MARKS: ITradingViewNativeTradeMark[] = [
  { index: 50, label: 'B' },
  { index: 57, label: 'S' },
  { index: 64, label: 'B' },
  { index: 64, label: 'B' },
  { index: 64, label: 'S' },
  { index: 72, label: 'B' },
  { index: 78, label: 'S' },
  { index: 85, label: 'B' },
  { index: 90, label: 'S' },
  { index: 94, label: 'B' },
].map(({ index, label }, order) => ({
  id: `mock-trade-${order}`,
  label: label === 'B' ? 'B' : 'S',
  text: `Mock ${label === 'B' ? 'buy' : 'sell'} ${(order + 1) * 10} COIN\nPrice: ${getMockPrice(index).toFixed(2)} USDT`,
  time: START_TIME + index * CANDLE_INTERVAL_SECONDS + order + 1,
}));

const MOCK_COMPONENTS: ITradingViewNativeChartLeafComponent[] = [
  { id: 'mock-trades', type: 'tradeMarks', props: { marks: MOCK_MARKS } },
];

const MOCK_CHART_PROPS: Omit<
  ITradingViewNativeChartProps,
  'chartSettings' | 'chartComponents'
> = {
  candleIntervalSeconds: CANDLE_INTERVAL_SECONDS,
  candleLabels: { open: 'O', high: 'H', low: 'L', close: 'C' },
  chartType: 'candlestick',
  chartPictureVersion: 0,
  currentPriceLabel: getMockPrice(95).toFixed(2),
  hasVolume: true,
  indicatorSeries: [],
  indicatorSeriesSettingsKey: 'mock-trades',
  initialRightOffset: { type: 'pointCount', value: 4 },
  isSwitchingInterval: false,
  locale: 'en-US',
  onSubIndicatorSettingsPress: () => undefined,
  points: MOCK_POINTS,
  priceAxisFontSize: TRADING_VIEW_NATIVE_PRICE_AXIS_FONT_SIZE,
  priceDecimalPlaces: 2,
  testID: 'trading-view-native-mock-trades-chart',
};

export function TradingViewNativeTradeMarksPreview() {
  const [showTrades, setShowTrades] = useState(true);
  const themeColors = useTradingViewSettingsThemeColors();
  const chartSettings = useMemo(
    () =>
      resolveTradingViewNativeChartThemeColors(DEFAULT_SETTINGS, themeColors),
    [themeColors],
  );

  return (
    <Stack gap="$3" testID="trading-view-native-mock-trades-preview">
      <SizableText size="$bodyMdMedium">Mock COIN / USDT · 15m</SizableText>
      <SizableText size="$bodySm" color="$textSubdued">
        96 synthetic candles and 10 mock trades, including three trades on one
        candle. B = buy, S = sell. Hover or long-press a marker for details.
      </SizableText>
      <XStack alignItems="center" gap="$2">
        <Switch
          testID="trading-view-native-mock-trades-toggle"
          value={showTrades}
          onChange={setShowTrades}
        />
        <SizableText size="$bodySm">Show mock trades</SizableText>
      </XStack>
      <Stack height={360} width="100%">
        <TradingViewNativeChart
          {...MOCK_CHART_PROPS}
          chartSettings={chartSettings}
          chartComponents={showTrades ? MOCK_COMPONENTS : EMPTY_COMPONENTS}
        />
      </Stack>
    </Stack>
  );
}
