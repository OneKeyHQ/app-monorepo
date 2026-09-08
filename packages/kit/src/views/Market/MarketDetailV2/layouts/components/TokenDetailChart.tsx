import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  ScrollView,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import { TradingViewDesktopToolbarContext } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/TradingViewDesktopToolbarContext';
import {
  type IMarketDetailChartDisplayMode,
  useMarketDetailChartDisplayModePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IStockSimpleChartRange,
  StockSimpleChart,
  TOKEN_SIMPLE_CHART_RANGES,
} from '../../components/StockSimpleChart';

import { MarketDetailProChartControls } from './MarketDetailProChartControls';
import {
  MARKET_CHART_TOOLBAR_VERTICAL_INSET,
  MARKET_SIMPLE_CHART_RANGE_WIDTHS,
} from './marketSimpleChartConstants';

function TokenChartModeControl({
  mode,
  onChange,
}: {
  mode: IMarketDetailChartDisplayMode;
  onChange: (mode: IMarketDetailChartDisplayMode) => void;
}) {
  const intl = useIntl();

  return (
    <XStack height={32} flexShrink={0} alignItems="center" gap="$0.5">
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
        {intl.formatMessage({ id: ETranslations.market_chart_mode_simple })}
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
  marketAssetId,
  marketTradingView,
  isChartFullscreen,
  chartMode,
  isChartSwitchDisabled,
  onChartSwitch,
  onEnterChartFullscreen,
}: {
  marketAssetId?: string;
  marketTradingView: ReactNode;
  isChartFullscreen: boolean;
  chartMode: ITradingViewChartMode;
  isChartSwitchDisabled?: boolean;
  onChartSwitch: () => void;
  onEnterChartFullscreen: () => void;
}) {
  const intl = useIntl();
  const [{ mode }, setChartDisplayMode] =
    useMarketDetailChartDisplayModePersistAtom();
  const [range, setRange] = useState<IStockSimpleChartRange>('1D');
  const isSimpleMode = mode === 'simple' && !isChartFullscreen;
  const handleModeChange = useCallback(
    (nextMode: IMarketDetailChartDisplayMode) => {
      setChartDisplayMode({ mode: nextMode });
    },
    [setChartDisplayMode],
  );

  const proToolbar = useMemo(
    () =>
      isChartFullscreen ? null : (
        <MarketDetailProChartControls
          inline
          testID="market-token-chart-mode-control-pro"
          top={MARKET_CHART_TOOLBAR_VERTICAL_INSET}
          fullscreenTestID="trading-view-native-fullscreen-toggle"
          chartMode={chartMode}
          isChartSwitchDisabled={isChartSwitchDisabled}
          onChartSwitch={onChartSwitch}
          onEnterChartFullscreen={onEnterChartFullscreen}
        >
          <TokenChartModeControl mode={mode} onChange={handleModeChange} />
        </MarketDetailProChartControls>
      ),
    [
      isChartFullscreen,
      chartMode,
      isChartSwitchDisabled,
      onChartSwitch,
      onEnterChartFullscreen,
      mode,
      handleModeChange,
    ],
  );

  return (
    // Simple mode stacks a 40px toolbar, a 16px gap and the flexible chart
    // into the block, matching the stock detail chart. Without the gap the
    // toolbar sits flush against the chart's top price label and the spare
    // 16px collects at the bottom of the block instead.
    <YStack
      width="100%"
      flex={1}
      minHeight={0}
      gap={isSimpleMode ? '$4' : '$0'}
      position="relative"
    >
      {isSimpleMode ? (
        <>
          <ScrollView
            testID="market-token-chart-toolbar"
            horizontal
            showsHorizontalScrollIndicator={false}
            width="100%"
            height={40}
            flexGrow={0}
            flexShrink={0}
            contentContainerStyle={{
              flexGrow: 1,
              py: '$1',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <XStack flexShrink={0} alignItems="center" gap="$0.5">
              {TOKEN_SIMPLE_CHART_RANGES.map((item) => {
                const itemWidth = MARKET_SIMPLE_CHART_RANGE_WIDTHS[item];
                return (
                  <Stack
                    key={item}
                    minWidth={itemWidth}
                    height={32}
                    flexShrink={0}
                  >
                    <Button
                      testID={`market-token-chart-range-${item}`}
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
            <TokenChartModeControl mode={mode} onChange={handleModeChange} />
          </ScrollView>
          <StockSimpleChart
            marketAssetId={marketAssetId}
            range={range}
            priceMode="token"
          />
        </>
      ) : (
        <>
          <TradingViewDesktopToolbarContext.Provider value={proToolbar}>
            <Stack flex={1} minWidth={0} overflow="hidden">
              {marketTradingView}
            </Stack>
          </TradingViewDesktopToolbarContext.Provider>
        </>
      )}
    </YStack>
  );
}
