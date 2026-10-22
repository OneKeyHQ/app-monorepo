import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  ScrollView,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import { TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/TradingViewV2ChartControls';

import { MARKET_SIMPLE_CHART_RANGE_LABEL_IDS } from './marketSimpleChartConstants';

import type {
  IStockSimpleChartRange,
  TOKEN_SIMPLE_CHART_RANGES,
} from '../../components/StockSimpleChart';

const MOBILE_SIMPLE_CHART_HEIGHT = 280;
// The range row mirrors the Pro interval bar (TradingViewChartControls on a
// non-compact mobile layout): 8pt padding, 30pt pills, at least 42pt wide.
const RANGE_BUTTON_HEIGHT = 30;
const RANGE_BUTTON_MIN_WIDTH = 42;

const RANGE_ROW_STYLE = {
  flexGrow: 1,
  alignItems: 'center',
} as const;

export type IMobileSimpleChartRange =
  (typeof TOKEN_SIMPLE_CHART_RANGES)[number];

export function MobileSimpleChartFrame<TRange extends IStockSimpleChartRange>({
  range,
  onRangeChange,
  chartRanges,
  height,
  modeControl,
  children,
  testID = 'market-mobile-simple-chart',
  controlsPaddingHorizontal = 8,
}: {
  range: TRange;
  onRangeChange: (range: TRange) => void;
  chartRanges: readonly TRange[];
  height?: number;
  modeControl: ReactNode;
  children: ReactNode;
  testID?: string;
  controlsPaddingHorizontal?: IXStackProps['px'];
}) {
  const intl = useIntl();

  const chartHeight =
    height === undefined
      ? MOBILE_SIMPLE_CHART_HEIGHT
      : Math.max(0, height - TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT);

  return (
    <YStack width="100%" testID={testID}>
      <XStack
        h={TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT}
        px={controlsPaddingHorizontal}
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
              testID={`${testID === 'market-mobile-simple-chart' ? 'market-mobile-chart' : testID}-range-${item}`}
              minWidth={RANGE_BUTTON_MIN_WIDTH}
              height={RANGE_BUTTON_HEIGHT}
              m="$0"
              px="$2.5"
              borderWidth={0}
              size="small"
              variant={range === item ? 'secondary' : 'tertiary'}
              borderRadius="$full"
              onPress={() => onRangeChange(item)}
            >
              {intl.formatMessage({
                id: MARKET_SIMPLE_CHART_RANGE_LABEL_IDS[item],
              })}
            </Button>
          ))}
        </ScrollView>
        {modeControl}
      </XStack>
      <Stack height={chartHeight} width="100%">
        {children}
      </Stack>
    </YStack>
  );
}
