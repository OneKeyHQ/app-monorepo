import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  type IStockSimpleChartRange,
  StockSimpleChart,
  TOKEN_SIMPLE_CHART_RANGES,
} from '../../components/StockSimpleChart';

import { MarketDesktopChartContainer } from './MarketDesktopChartContainer';
import { MarketDetailProChartControls } from './MarketDetailProChartControls';
import {
  MARKET_CHART_TOOLBAR_HEIGHT,
  MARKET_CHART_TOOLBAR_VERTICAL_INSET,
  MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH,
} from './marketSimpleChartConstants';

const TOOLBAR_CONTENT_STYLE = {
  flexGrow: 1,
  alignItems: 'center',
  gap: '$3',
} as const;

const FALLBACK_TOOLBAR_CONTENT_STYLE = {
  flexGrow: 1,
  py: '$1',
  alignItems: 'center',
  justifyContent: 'flex-end',
} as const;

function TokenChartModeControl({
  mode,
  onChange,
}: {
  mode: IMarketDetailChartDisplayMode;
  onChange: (mode: IMarketDetailChartDisplayMode) => void;
}) {
  const intl = useIntl();

  // Figma 26552:24701. The small button supplies the 18px leading icon $2
  // from its label, but its $2.5 padding only survives on `secondary`:
  // `tertiary` is hard-coded to $2 so it can sit inline like a link. The
  // design wants both states on the same box, so px is set here — without it
  // the pill jumps 2px per side as the selection moves.
  return (
    <XStack alignItems="center" gap="$0.5" flexShrink={0}>
      <Button
        testID="market-token-chart-mode-simple"
        height={32}
        m="$0"
        px="$2.5"
        borderWidth={0}
        flexShrink={0}
        icon="TradingViewLineOutline"
        size="small"
        variant={mode === 'simple' ? 'secondary' : 'tertiary'}
        borderRadius="$full"
        onPress={() => onChange('simple')}
      >
        {intl.formatMessage({ id: ETranslations.market_chart_mode_simple })}
      </Button>
      <Button
        testID="market-token-chart-mode-pro"
        height={32}
        m="$0"
        px="$2.5"
        borderWidth={0}
        flexShrink={0}
        icon="TradingViewCandlesOutline"
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
  chartContainerTestID,
  fullscreenStyle,
  fullscreenZIndex,
  marketAssetId,
  marketTradingView,
  isChartFullscreen,
  chartMode,
  isChartSwitchDisabled,
  onChartSwitch,
  onEnterChartFullscreen,
}: {
  chartContainerTestID?: string;
  fullscreenStyle?: CSSProperties;
  fullscreenZIndex?: number;
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

  // Rides inside TradingView's own desktop toolbar instead of floating over
  // the chart, so the controls never sit on top of the candles. No children:
  // the Simple/Pro switch belongs to the toolbar under the chart, and passing
  // it here as well would render a second one.
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
        />
      ),
    [
      chartMode,
      isChartFullscreen,
      isChartSwitchDisabled,
      onChartSwitch,
      onEnterChartFullscreen,
    ],
  );

  // The toolbar goes to the container's footer, under the resize handle: the
  // handle's line has to sit on the chart's own clipping edge to read as the
  // cut it makes while dragging, so nothing of ours may live below it inside
  // the resizable box. It scrolls horizontally so a narrow chart clips no
  // range button.
  const toolbar = isChartFullscreen ? undefined : (
    <ScrollView
      testID="market-token-chart-toolbar"
      horizontal
      showsHorizontalScrollIndicator={false}
      width="100%"
      height={MARKET_CHART_TOOLBAR_HEIGHT}
      flexGrow={0}
      flexShrink={0}
      contentContainerStyle={TOOLBAR_CONTENT_STYLE}
    >
      <XStack flex={1} minWidth={0} alignItems="center" gap="$0.5">
        {isSimpleMode
          ? TOKEN_SIMPLE_CHART_RANGES.map((item) => {
              return (
                <Stack
                  key={item}
                  minWidth={MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH}
                  height={32}
                  flexShrink={0}
                >
                  <Button
                    testID={`market-token-chart-range-${item}`}
                    minWidth={MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH}
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
            })
          : null}
      </XStack>
      <TokenChartModeControl mode={mode} onChange={handleModeChange} />
    </ScrollView>
  );

  return (
    // Figma 26459:25760 / 26459:25981: the chart owns the resizable block and
    // the toolbar sits under it. Pro keeps only the mode switch there —
    // TradingView carries its own interval row, so an app-side range selector
    // would be a second, disagreeing control.
    <MarketDesktopChartContainer
      testID={chartContainerTestID}
      isFullscreen={isChartFullscreen}
      fullscreenZIndex={fullscreenZIndex}
      fullscreenStyle={fullscreenStyle}
      footer={toolbar}
    >
      {/* Desktop keeps the draggable title bar clear of the fullscreen chart. */}
      {isChartFullscreen && platformEnv.isDesktop ? (
        <Stack height={48} bg="$bgApp" flexShrink={0} />
      ) : null}
      <YStack width="100%" flex={1} minHeight={0} position="relative">
        {isSimpleMode ? (
          <StockSimpleChart
            marketAssetId={marketAssetId}
            range={range}
            priceMode="token"
          />
        ) : (
          <>
            {/* Nothing hosts these controls when the Pro chart is missing, so
                they take a row of their own rather than vanishing with it. */}
            {marketTradingView === null || marketTradingView === undefined ? (
              <ScrollView
                testID="market-token-chart-fallback-toolbar"
                horizontal
                showsHorizontalScrollIndicator={false}
                width="100%"
                height={MARKET_CHART_TOOLBAR_HEIGHT}
                flexGrow={0}
                flexShrink={0}
                contentContainerStyle={FALLBACK_TOOLBAR_CONTENT_STYLE}
              >
                {proToolbar}
              </ScrollView>
            ) : null}
            <TradingViewDesktopToolbarContext.Provider value={proToolbar}>
              <Stack flex={1} minWidth={0} overflow="hidden">
                {marketTradingView}
              </Stack>
            </TradingViewDesktopToolbarContext.Provider>
          </>
        )}
      </YStack>
    </MarketDesktopChartContainer>
  );
}
