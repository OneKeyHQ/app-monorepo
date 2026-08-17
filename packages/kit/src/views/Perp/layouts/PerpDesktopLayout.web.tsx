import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { Spotlight } from '../../../components/Spotlight';
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
  PERP_DESKTOP_CHART_MIN_HEIGHT,
  PERP_DESKTOP_INFO_MIN_HEIGHT,
  getPerpDesktopChartSplitSizes,
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
    'row-resize' | undefined
  >();
  const chartSplitRef = useRef<AllotmentHandle>(null);
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
  const showOrderBook =
    gtXl && !chartExpanded && (layoutState.orderBook?.visible ?? true);
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
  const toggleOrderBook = useCallback(() => {
    setLayoutState((prev) => ({
      ...prev,
      orderBook: { visible: !(prev.orderBook?.visible ?? true) },
    }));
  }, [setLayoutState]);
  const handleTradingViewTouchScroll = useCallback((deltaY: number) => {
    scrollContainerRef.current?.scrollBy({ top: deltaY });
  }, []);
  const handleVerticalSplitDragStart = useCallback(() => {
    setDesktopSplitCursor('row-resize');
  }, []);
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
  // Allotment only honors defaultSizes on first mount; re-apply persisted
  // heights after async atom hydration and on responsive layout changes.
  useLayoutEffect(() => {
    chartSplitRef.current?.resize(chartSplitSizes);
  }, [chartSplitSizes]);

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
      position="relative"
      h="100%"
      alignItems="stretch"
      style={{
        borderTopColor: theme.borderSubdued.val,
        borderTopStyle: 'solid',
        borderTopWidth: 1,
      }}
    >
      <Spotlight
        isVisible={!chartExpanded}
        tourName={ESpotlightTour.perpDesktopChartResize}
        message={intl.formatMessage({
          id: ETranslations.perps_desktop_resize_panels__desc,
        })}
        delayMs={700}
        floatingOffset={8}
        childrenPaddingHorizontal={8}
        childrenPaddingVertical={6}
        showHighlightBackground
        highlightBackgroundOpacity={0.6}
        replaceChildren={
          <Stack w={160} h={4} bg="$borderActive" borderRadius="$full" />
        }
        containerProps={{
          testID: PerpTestIDs.DesktopChartResizeSpotlight,
          position: 'absolute',
          top: -1,
          left: '50%',
          marginLeft: -80,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <Stack w={160} h={1} />
      </Spotlight>
      {/* Inline min-height: tall tab content must not inflate this flex item
          past the bounded pane, so the tabs can scroll internally. */}
      <YStack flex={1} style={{ minHeight: 0 }}>
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
            flex={chartExpanded ? 1 : undefined}
            h={chartExpanded ? undefined : leftContentHeight}
            overflow="hidden"
          >
            <XStack h="100%" overflow="hidden">
              <YStack
                flex={1}
                minWidth={PERP_LAYOUT_CONFIG.main.marketMinWidth}
                overflow="hidden"
              >
                <Allotment
                  ref={chartSplitRef}
                  id={PerpTestIDs.DesktopChartSplit}
                  vertical
                  separator={false}
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
              </YStack>

              <YStack
                display={chartExpanded ? 'none' : 'flex'}
                w={layout.widths.trading}
                minWidth={PERP_LAYOUT_CONFIG.main.tradingMinWidth}
                maxWidth={PERP_LAYOUT_CONFIG.main.tradingMaxWidth}
                borderLeftWidth="$px"
                borderLeftColor="$borderSubdued"
                overflow="hidden"
              >
                <YStack h={layout.marketContentHeight} overflow="hidden">
                  {tradingPanel}
                </YStack>
                <YStack
                  testID={PerpTestIDs.DesktopAccountBoundary}
                  h={layout.bottomPanelHeight}
                  overflow="hidden"
                  style={{
                    borderTopColor: theme.borderSubdued.val,
                    borderTopStyle: 'solid',
                    borderTopWidth: 1,
                  }}
                >
                  {accountPanel}
                </YStack>
              </YStack>
            </XStack>
          </Stack>
        </YStack>
      </YStack>
    </Stack>
  );
}

export { PerpDesktopLayout };
