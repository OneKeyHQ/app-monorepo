import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import { usePerpsLayoutStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { FavoritesBar } from '../components/FavoritesBar/FavoritesBar.web';
import { PerpMarketWorkspacePanel } from '../components/MarketDetail/PerpMarketWorkspacePanel';
import { PerpOrderInfoPanel } from '../components/OrderInfoPanel/PerpOrderInfoPanel';
import { PerpNetworkAlert } from '../components/PerpNetworkAlert';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { PerpTips } from '../components/PerpTips';
import { PerpTickerBar } from '../components/TickerBar/PerpTickerBar';
import {
  PerpAccountDebugInfo,
  PerpAccountPanel,
} from '../components/TradingPanel/panels/PerpAccountPanel';
import { PerpTradingPanel } from '../components/TradingPanel/PerpTradingPanel';
import { PerpTestIDs } from '../testIDs';

import {
  PERP_DESKTOP_ACCOUNT_PANEL_MIN_HEIGHT,
  PERP_DESKTOP_CHART_MIN_HEIGHT,
  PERP_DESKTOP_INFO_MIN_HEIGHT,
  PERP_DESKTOP_TRADING_MIN_WIDTH,
  PERP_DESKTOP_TRADING_PANEL_MIN_HEIGHT,
  getPerpDesktopChartSplitSizes,
  getPerpDesktopMainSplitSizes,
  getPerpDesktopTradingSplitSizes,
  getResponsivePerpDesktopLayout,
} from './perpLayoutUtils';

import type { AllotmentHandle } from 'allotment';

function PerpDesktopLayout() {
  const intl = useIntl();
  const { gtXl } = useMedia();
  const theme = useTheme();
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const [layoutState, setLayoutState] = usePerpsLayoutStateAtom();
  const [desktopSplitCursor, setDesktopSplitCursor] = useState<
    'col-resize' | 'row-resize' | undefined
  >();
  const mainSplitRef = useRef<AllotmentHandle>(null);
  const chartSplitRef = useRef<AllotmentHandle>(null);
  const tradingSplitRef = useRef<AllotmentHandle>(null);
  const mainSplitContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);

  const layout = useMemo(
    () => getResponsivePerpDesktopLayout(viewportWidth, viewportHeight),
    [viewportHeight, viewportWidth],
  );

  // Reset chartExpanded on mount to stay in sync with iframe state
  useEffect(() => {
    setLayoutState((prev) =>
      prev.chartExpanded ? { ...prev, chartExpanded: false } : prev,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartExpanded = layoutState.chartExpanded ?? false;
  const mainSplitSizes = useMemo(
    () =>
      getPerpDesktopMainSplitSizes({
        availableWidth: viewportWidth,
        defaultTradingWidth: layout.widths.trading,
        savedTradingWidth: layoutState.tradingWidth,
      }),
    [layout.widths.trading, layoutState.tradingWidth, viewportWidth],
  );
  const chartSplitSizes = useMemo(
    () =>
      getPerpDesktopChartSplitSizes({
        marketContentHeight: layout.marketContentHeight,
        bottomPanelHeight: layout.bottomPanelHeight,
        savedChartHeight: layoutState.chartHeight,
      }),
    [
      layout.bottomPanelHeight,
      layout.marketContentHeight,
      layoutState.chartHeight,
    ],
  );
  const tradingSplitSizes = useMemo(
    () =>
      getPerpDesktopTradingSplitSizes({
        marketContentHeight: layout.marketContentHeight,
        bottomPanelHeight: layout.bottomPanelHeight,
        savedTradingPanelHeight: layoutState.tradingPanelHeight,
      }),
    [
      layout.bottomPanelHeight,
      layout.marketContentHeight,
      layoutState.tradingPanelHeight,
    ],
  );
  const splitThemeStyle = useMemo(
    () =>
      ({
        '--separator-border': theme.borderStrong.val,
        '--focus-border': theme.borderActive.val,
      }) as CSSProperties,
    [theme.borderActive.val, theme.borderStrong.val],
  );
  const leftContentHeight =
    layout.marketContentHeight + layout.bottomPanelHeight;
  const showOrderBook =
    gtXl && !chartExpanded && (layoutState.orderBook?.visible ?? true);
  const toggleOrderBook = useCallback(() => {
    setLayoutState((prev) => ({
      ...prev,
      orderBook: { visible: !(prev.orderBook?.visible ?? true) },
    }));
  }, [setLayoutState]);
  const handleTradingViewTouchScroll = useCallback((deltaY: number) => {
    scrollContainerRef.current?.scrollBy({ top: deltaY });
  }, []);
  const handleMainSplitDragStart = useCallback(() => {
    setDesktopSplitCursor('col-resize');
  }, []);
  const handleVerticalSplitDragStart = useCallback(() => {
    setDesktopSplitCursor('row-resize');
  }, []);
  const handleMainSplitDragEnd = useCallback(
    (sizes: number[]) => {
      setDesktopSplitCursor(undefined);
      const nextTradingWidth = Math.round(sizes[1] ?? 0);
      if (!Number.isFinite(nextTradingWidth) || nextTradingWidth <= 0) {
        return;
      }
      setLayoutState((prev) =>
        prev.tradingWidth === nextTradingWidth
          ? prev
          : { ...prev, tradingWidth: nextTradingWidth },
      );
    },
    [setLayoutState],
  );
  const handleChartSplitDragEnd = useCallback(
    (sizes: number[]) => {
      setDesktopSplitCursor(undefined);
      const nextChartHeight = Math.round(sizes[0] ?? 0);
      if (!Number.isFinite(nextChartHeight) || nextChartHeight <= 0) {
        return;
      }
      setLayoutState((prev) =>
        prev.chartHeight === nextChartHeight
          ? prev
          : { ...prev, chartHeight: nextChartHeight },
      );
    },
    [setLayoutState],
  );
  const handleTradingSplitDragEnd = useCallback(
    (sizes: number[]) => {
      setDesktopSplitCursor(undefined);
      const nextTradingPanelHeight = Math.round(sizes[0] ?? 0);
      if (
        !Number.isFinite(nextTradingPanelHeight) ||
        nextTradingPanelHeight <= 0
      ) {
        return;
      }
      setLayoutState((prev) =>
        prev.tradingPanelHeight === nextTradingPanelHeight
          ? prev
          : { ...prev, tradingPanelHeight: nextTradingPanelHeight },
      );
    },
    [setLayoutState],
  );
  const handleMainSplitReset = useCallback(() => {
    const availableWidth =
      mainSplitContainerRef.current?.offsetWidth || viewportWidth;
    mainSplitRef.current?.resize(
      getPerpDesktopMainSplitSizes({
        availableWidth,
        defaultTradingWidth: layout.widths.trading,
      }),
    );
    setLayoutState((prev) => {
      if (prev.tradingWidth === undefined) {
        return prev;
      }
      const { tradingWidth: _tradingWidth, ...rest } = prev;
      return rest;
    });
  }, [layout.widths.trading, setLayoutState, viewportWidth]);
  const handleChartSplitReset = useCallback(() => {
    chartSplitRef.current?.resize([
      layout.marketContentHeight,
      layout.bottomPanelHeight,
    ]);
    setLayoutState((prev) => {
      if (prev.chartHeight === undefined) {
        return prev;
      }
      const { chartHeight: _chartHeight, ...rest } = prev;
      return rest;
    });
  }, [layout.bottomPanelHeight, layout.marketContentHeight, setLayoutState]);
  const handleTradingSplitReset = useCallback(() => {
    tradingSplitRef.current?.resize([
      layout.marketContentHeight,
      layout.bottomPanelHeight,
    ]);
    setLayoutState((prev) => {
      if (prev.tradingPanelHeight === undefined) {
        return prev;
      }
      const { tradingPanelHeight: _tradingPanelHeight, ...rest } = prev;
      return rest;
    });
  }, [layout.bottomPanelHeight, layout.marketContentHeight, setLayoutState]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const availableWidth =
        mainSplitContainerRef.current?.offsetWidth || viewportWidth;
      mainSplitRef.current?.resize(
        getPerpDesktopMainSplitSizes({
          availableWidth,
          defaultTradingWidth: layout.widths.trading,
          savedTradingWidth: layoutState.tradingWidth,
        }),
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [layout.widths.trading, layoutState.tradingWidth, viewportWidth]);

  const tradingPanel = useMemo(() => {
    return (
      <YStack h="100%" style={{ overflowY: 'auto' }}>
        <YStack minHeight={layout.marketContentHeight} pb="$4">
          <PerpTradingPanel />
        </YStack>
      </YStack>
    );
  }, [layout.marketContentHeight]);

  const accountPanel = useMemo(() => {
    return (
      <YStack h="100%" alignSelf="stretch" style={{ overflowY: 'auto' }}>
        <YStack minHeight={layout.bottomPanelHeight}>
          <XStack alignItems="center">
            <XStack py="$3" px="$2.5">
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.perp_trade_account_overview,
                })}
              </SizableText>
            </XStack>
          </XStack>
          <YStack pb="$4">
            <PerpAccountPanel />
            <PerpAccountDebugInfo />
          </YStack>
        </YStack>
      </YStack>
    );
  }, [intl, layout.bottomPanelHeight]);

  const marketPanel = (
    <XStack h="100%" overflow="hidden">
      <YStack flex={1} position="relative">
        <PerpMarketWorkspacePanel
          onTouchScroll={handleTradingViewTouchScroll}
        />

        {desktopSplitCursor ? (
          <Stack
            testID={PerpTestIDs.DesktopChartDragShield}
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            left={0}
            zIndex={30}
            cursor={desktopSplitCursor}
          />
        ) : null}

        <Stack
          display={gtXl && !chartExpanded ? 'flex' : 'none'}
          position="absolute"
          top="50%"
          right={showOrderBook ? -4 : 3.5}
          zIndex={2}
          marginTop={-2}
        >
          <IconButton
            testID="perp-icon-btn"
            icon={
              showOrderBook ? 'ChevronRightSmallSolid' : 'ChevronLeftSmallSolid'
            }
            size="small"
            variant="tertiary"
            bg="$bg"
            borderWidth="$px"
            borderColor="$borderSubdued"
            borderRadius="$1"
            p="$0"
            h={30}
            w={16}
            cursor="default"
            hoverStyle={{
              borderColor: '$border',
            }}
            pressStyle={{
              borderColor: '$border',
            }}
            onPress={toggleOrderBook}
          />
        </Stack>
      </YStack>

      {showOrderBook ? (
        <YStack
          borderLeftWidth="$px"
          borderLeftColor="$borderSubdued"
          w={layout.widths.orderBook}
          h="100%"
          overflow="hidden"
        >
          <XStack
            h={layout.panelHeaderHeight}
            alignItems="center"
            borderBottomWidth="$px"
            borderBottomColor="$borderSubdued"
            px="$2"
          >
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: ETranslations.perps_order_book,
              })}
            </SizableText>
          </XStack>
          <YStack flex={1} overflow="hidden">
            <PerpOrderBook
              initialOrderBookHeight={
                chartSplitSizes[0] - layout.panelHeaderHeight
              }
            />
          </YStack>
        </YStack>
      ) : null}
    </XStack>
  );

  const orderInfoPanel = (
    <XStack
      testID={PerpTestIDs.DesktopChartBoundary}
      h="100%"
      alignItems="stretch"
      style={{
        borderTopColor: theme.borderSubdued.val,
        borderTopStyle: 'solid',
        borderTopWidth: 1,
      }}
    >
      <YStack flex={1}>
        <PerpOrderInfoPanel />
      </YStack>
    </XStack>
  );

  return (
    <Stack
      ref={scrollContainerRef as any}
      testID={PerpTestIDs.DesktopSplitRoot}
      flex={1}
      style={{
        ...splitThemeStyle,
        overflowY: chartExpanded ? 'hidden' : 'auto',
      }}
    >
      <YStack flex={chartExpanded ? 1 : undefined}>
        <PerpTips />
        <PerpNetworkAlert />
        {chartExpanded ? null : <FavoritesBar />}

        <YStack
          flex={chartExpanded ? 1 : undefined}
          borderBottomWidth="$px"
          borderBottomColor="$borderSubdued"
        >
          <PerpTickerBar />

          <Stack
            ref={mainSplitContainerRef as any}
            flex={chartExpanded ? 1 : undefined}
            h={chartExpanded ? undefined : leftContentHeight}
            overflow="hidden"
          >
            <Allotment
              ref={mainSplitRef}
              id={PerpTestIDs.DesktopMainSplit}
              separator={!chartExpanded}
              defaultSizes={mainSplitSizes}
              onDragStart={handleMainSplitDragStart}
              onDragEnd={handleMainSplitDragEnd}
              onReset={handleMainSplitReset}
            >
              <Allotment.Pane minSize={PERP_LAYOUT_CONFIG.main.marketMinWidth}>
                <Stack h="100%" overflow="hidden">
                  <Allotment
                    ref={chartSplitRef}
                    id={PerpTestIDs.DesktopChartSplit}
                    vertical
                    separator={!chartExpanded}
                    defaultSizes={chartSplitSizes}
                    onDragStart={handleVerticalSplitDragStart}
                    onDragEnd={handleChartSplitDragEnd}
                    onReset={handleChartSplitReset}
                  >
                    <Allotment.Pane
                      minSize={PERP_DESKTOP_CHART_MIN_HEIGHT}
                      preferredSize={layout.marketContentHeight}
                    >
                      {marketPanel}
                    </Allotment.Pane>
                    <Allotment.Pane
                      minSize={PERP_DESKTOP_INFO_MIN_HEIGHT}
                      visible={!chartExpanded}
                    >
                      {orderInfoPanel}
                    </Allotment.Pane>
                  </Allotment>
                </Stack>
              </Allotment.Pane>

              <Allotment.Pane
                minSize={PERP_DESKTOP_TRADING_MIN_WIDTH}
                maxSize={PERP_LAYOUT_CONFIG.main.tradingMaxWidth}
                visible={!chartExpanded}
              >
                <Stack h="100%" overflow="hidden">
                  <Allotment
                    ref={tradingSplitRef}
                    id={PerpTestIDs.DesktopTradingSplit}
                    vertical
                    defaultSizes={tradingSplitSizes}
                    onDragStart={handleVerticalSplitDragStart}
                    onDragEnd={handleTradingSplitDragEnd}
                    onReset={handleTradingSplitReset}
                  >
                    <Allotment.Pane
                      minSize={PERP_DESKTOP_TRADING_PANEL_MIN_HEIGHT}
                      preferredSize={layout.marketContentHeight}
                    >
                      {tradingPanel}
                    </Allotment.Pane>
                    <Allotment.Pane
                      minSize={PERP_DESKTOP_ACCOUNT_PANEL_MIN_HEIGHT}
                    >
                      {accountPanel}
                    </Allotment.Pane>
                  </Allotment>
                </Stack>
              </Allotment.Pane>
            </Allotment>
          </Stack>
        </YStack>
      </YStack>
    </Stack>
  );
}

export { PerpDesktopLayout };
