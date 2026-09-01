import { useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { Button, Stack, XStack, YStack } from '@onekeyhq/components';
import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IStockSimpleChartRange,
  StockSimpleChart,
} from '../../components/StockSimpleChart';

import { MarketDetailProChartControls } from './MarketDetailProChartControls';
import {
  MARKET_CHART_TOOLBAR_VERTICAL_INSET,
  MARKET_SIMPLE_CHART_RANGES,
  MARKET_SIMPLE_CHART_RANGE_ROW_WIDTH,
  MARKET_SIMPLE_CHART_RANGE_WIDTHS,
} from './marketSimpleChartConstants';

type ITokenChartMode = 'simple' | 'pro';

function TokenChartModeControl({
  mode,
  onChange,
}: {
  mode: ITokenChartMode;
  onChange: (mode: ITokenChartMode) => void;
}) {
  const intl = useIntl();

  return (
    <XStack height={32} alignItems="center" gap="$0.5">
      <Button
        testID="market-token-chart-mode-simple"
        minWidth={62}
        height={32}
        m="$0"
        px="$2"
        borderWidth={0}
        size="small"
        variant={mode === 'simple' ? 'secondary' : 'tertiary'}
        borderRadius="$full"
        onPress={() => onChange('simple')}
      >
        Simple
      </Button>
      <Button
        testID="market-token-chart-mode-pro"
        minWidth={40}
        height={32}
        m="$0"
        px="$2"
        borderWidth={0}
        size="small"
        variant={mode === 'pro' ? 'secondary' : 'tertiary'}
        borderRadius="$full"
        onPress={() => onChange('pro')}
      >
        {intl.formatMessage({ id: ETranslations.dexmarket_pro })}
      </Button>
    </XStack>
  );
}

export function TokenDetailChart({
  fallbackCoinGeckoId,
  marketTradingView,
  isChartFullscreen,
  chartMode,
  isChartSwitchDisabled,
  onChartSwitch,
  onEnterChartFullscreen,
}: {
  fallbackCoinGeckoId?: string;
  marketTradingView: ReactNode;
  isChartFullscreen: boolean;
  chartMode: ITradingViewChartMode;
  isChartSwitchDisabled?: boolean;
  onChartSwitch: () => void;
  onEnterChartFullscreen: () => void;
}) {
  const intl = useIntl();
  const [mode, setMode] = useState<ITokenChartMode>('simple');
  const [range, setRange] = useState<IStockSimpleChartRange>('1D');
  const isSimpleMode = mode === 'simple' && !isChartFullscreen;

  return (
    // Simple mode stacks a 40px toolbar, a 16px gap and the 304px chart into
    // the 360px block, matching the stock detail chart. Without the gap the
    // toolbar sits flush against the chart's top price label and the spare
    // 16px collects at the bottom of the block instead.
    <YStack
      width="100%"
      height="100%"
      gap={isSimpleMode ? '$4' : '$0'}
      position="relative"
    >
      {isSimpleMode ? (
        <>
          <XStack
            testID="market-token-chart-toolbar"
            height={40}
            py="$1"
            alignItems="center"
            justifyContent="space-between"
          >
            <XStack
              width={MARKET_SIMPLE_CHART_RANGE_ROW_WIDTH}
              alignItems="center"
              gap="$0.5"
            >
              {MARKET_SIMPLE_CHART_RANGES.map((item) => {
                const itemWidth = MARKET_SIMPLE_CHART_RANGE_WIDTHS[item];
                return (
                  <Stack
                    key={item}
                    width={itemWidth}
                    minWidth={itemWidth}
                    height={32}
                    flexShrink={0}
                  >
                    <Button
                      testID={`market-token-chart-range-${item}`}
                      width="100%"
                      minWidth={itemWidth}
                      height={32}
                      m="$0"
                      px="$2"
                      borderWidth={0}
                      size="small"
                      variant={range === item ? 'secondary' : 'tertiary'}
                      borderRadius="$full"
                      onPress={() => setRange(item)}
                    >
                      {item === 'All'
                        ? intl.formatMessage({ id: ETranslations.global_all })
                        : item}
                    </Button>
                  </Stack>
                );
              })}
            </XStack>
            <TokenChartModeControl mode={mode} onChange={setMode} />
          </XStack>
          <StockSimpleChart
            coinGeckoId={fallbackCoinGeckoId}
            range={range}
            priceMode="token"
          />
        </>
      ) : (
        <>
          <Stack flex={1} minWidth={0} overflow="hidden">
            {marketTradingView}
          </Stack>
          {isChartFullscreen ? null : (
            <MarketDetailProChartControls
              testID="market-token-chart-mode-control-pro"
              top={MARKET_CHART_TOOLBAR_VERTICAL_INSET}
              fullscreenTestID="trading-view-native-fullscreen-toggle"
              chartMode={chartMode}
              isChartSwitchDisabled={isChartSwitchDisabled}
              onChartSwitch={onChartSwitch}
              onEnterChartFullscreen={onEnterChartFullscreen}
            >
              <TokenChartModeControl mode={mode} onChange={setMode} />
            </MarketDetailProChartControls>
          )}
        </>
      )}
    </YStack>
  );
}
