import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { debounce } from 'lodash';

import {
  IconButton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import {
  DEFAULT_PERPS_LAYOUT_STATE,
  usePerpsLayoutStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { PerpOrderInfoPanel } from '../components/OrderInfoPanel/PerpOrderInfoPanel';
import { PerpCandles } from '../components/PerpCandles';
import { PerpOrderBookResizable } from '../components/PerpOrderBookResizable.web';
import { PerpTips } from '../components/PerpTips';
import { PerpTickerBar } from '../components/TickerBar/PerpTickerBar';
import {
  PerpAccountDebugInfo,
  PerpAccountPanel,
} from '../components/TradingPanel/panels/PerpAccountPanel';
import { PerpTradingPanel } from '../components/TradingPanel/PerpTradingPanel';

import type { AllotmentHandle } from 'allotment';

function PerpDesktopLayout() {
  const { gtXl } = useMedia();
  const mainAllotmentRef = useRef<AllotmentHandle>(null);
  const leftPanelAllotmentRef = useRef<AllotmentHandle>(null);
  const isInitializedRef = useRef(false);
  const lastResetAtRef = useRef<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const [layoutState, setLayoutState] = usePerpsLayoutStateAtom();
  const setLayoutStateRef = useRef(setLayoutState);
  setLayoutStateRef.current = setLayoutState;

  const mainSizes = useMemo(
    () => [layoutState.main.marketRatio, 100 - layoutState.main.marketRatio],
    [layoutState.main.marketRatio],
  );

  const leftPanelSizes = useMemo(
    () => [
      layoutState.leftPanel.chartsRatio,
      100 - layoutState.leftPanel.chartsRatio,
    ],
    [layoutState.leftPanel.chartsRatio],
  );

  const handleMainChangeDebounced = useMemo(
    () =>
      debounce((sizes: number[]) => {
        if (!isInitializedRef.current) return;

        const totalSize = sizes[0] + sizes[1];
        const marketRatioPercent = (sizes[0] / totalSize) * 100;

        setLayoutStateRef.current((prev) => ({
          ...prev,
          main: { marketRatio: marketRatioPercent },
        }));
      }, 500),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleLeftPanelChangeDebounced = useMemo(
    () =>
      debounce((sizes: number[]) => {
        if (!isInitializedRef.current) return;

        const totalSize = sizes[0] + sizes[1];
        const chartsRatioPercent = (sizes[0] / totalSize) * 100;

        setLayoutStateRef.current((prev) => ({
          ...prev,
          leftPanel: { chartsRatio: chartsRatioPercent },
        }));
      }, 500),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleLeftPanelChange = useCallback(
    (sizes: number[]) => {
      handleLeftPanelChangeDebounced(sizes);

      if (!PERP_LAYOUT_CONFIG.enableAutoCollapse) return;

      const chartsSize = sizes[0];
      const infoPanelSize = sizes[1];

      let needsUpdate = false;
      let newChartsSize = chartsSize;
      let newInfoPanelSize = infoPanelSize;

      if (
        chartsSize > 0 &&
        chartsSize < PERP_LAYOUT_CONFIG.leftPanel.charts.collapseThreshold
      ) {
        newChartsSize = 0;
        newInfoPanelSize = chartsSize + infoPanelSize;
        needsUpdate = true;
      }

      if (
        infoPanelSize > 0 &&
        infoPanelSize < PERP_LAYOUT_CONFIG.leftPanel.infoPanel.collapseThreshold
      ) {
        newChartsSize = chartsSize + infoPanelSize;
        newInfoPanelSize = 0;
        needsUpdate = true;
      }

      if (needsUpdate) {
        leftPanelAllotmentRef.current?.resize([
          newChartsSize,
          newInfoPanelSize,
        ]);
      }
    },
    [handleLeftPanelChangeDebounced],
  );

  const toggleOrderBook = useCallback(() => {
    setLayoutState((prev) => ({
      ...prev,
      orderBook: { visible: !prev.orderBook.visible },
    }));
  }, [setLayoutState]);

  const applyDefaultLayout = useCallback(() => {
    if (!mainAllotmentRef.current || !containerRef.current) return;

    requestAnimationFrame(() => {
      if (!mainAllotmentRef.current || !containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      if (containerWidth === 0) return;

      const tradingWidth = gtXl
        ? PERP_LAYOUT_CONFIG.main.tradingDefaultWidthXl
        : PERP_LAYOUT_CONFIG.main.tradingDefaultWidth;
      const marketWidth = containerWidth - tradingWidth;

      mainAllotmentRef.current.resize([marketWidth, tradingWidth]);

      if (leftPanelAllotmentRef.current) {
        leftPanelAllotmentRef.current.reset();
      }

      setLayoutStateRef.current((prev) => {
        const { resetAt, ...rest } = prev;
        return rest;
      });
    });
  }, [gtXl]);

  useEffect(() => {
    const timer = setTimeout(() => {
      isInitializedRef.current = true;
    }, 500);

    return () => {
      clearTimeout(timer);
      handleMainChangeDebounced.cancel();
      handleLeftPanelChangeDebounced.cancel();
    };
  }, [handleMainChangeDebounced, handleLeftPanelChangeDebounced]);

  useEffect(() => {
    if (!isInitializedRef.current) return;

    if (
      layoutState.resetAt !== undefined &&
      layoutState.resetAt !== lastResetAtRef.current
    ) {
      lastResetAtRef.current = layoutState.resetAt;
      applyDefaultLayout();
    }
  }, [layoutState.resetAt, applyDefaultLayout]);

  useEffect(() => {
    // Check if this is first load and if layout is still at default values
    // This initializes resetAt to allow future reset detection
    const state = layoutState; // Capture initial state
    if (
      state.resetAt === undefined &&
      state.main.marketRatio === DEFAULT_PERPS_LAYOUT_STATE.main.marketRatio &&
      state.leftPanel.chartsRatio ===
        DEFAULT_PERPS_LAYOUT_STATE.leftPanel.chartsRatio
    ) {
      setLayoutStateRef.current((prev) => ({ ...prev, resetAt: 0 }));
    }
    // Only run on mount - layoutState is captured, not tracked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <YStack flex={1} bg="$bgApp">
      <YStack>
        <PerpTips />
        <PerpTickerBar />
      </YStack>

      <Stack ref={containerRef} flex={1} display="flex">
        <Allotment
          ref={mainAllotmentRef}
          defaultSizes={mainSizes}
          onChange={handleMainChangeDebounced}
        >
          <Allotment.Pane minSize={PERP_LAYOUT_CONFIG.main.marketMinWidth}>
            <YStack
              height="100%"
              borderRightWidth="$px"
              borderRightColor="$borderSubdued"
            >
              <Allotment
                ref={leftPanelAllotmentRef}
                vertical
                defaultSizes={leftPanelSizes}
                onChange={handleLeftPanelChange}
              >
                <Allotment.Pane
                  minSize={
                    PERP_LAYOUT_CONFIG.enableAutoCollapse
                      ? 0
                      : PERP_LAYOUT_CONFIG.leftPanel.charts.minHeight
                  }
                  snap={PERP_LAYOUT_CONFIG.enableAutoCollapse}
                  preferredSize={`${PERP_LAYOUT_CONFIG.leftPanel.charts.defaultRatio}%`}
                >
                  <XStack
                    height="100%"
                    borderBottomWidth="$px"
                    borderBottomColor="$borderSubdued"
                  >
                    <YStack flex={1} position="relative">
                      <PerpCandles />
                      {gtXl ? (
                        <Stack
                          position="absolute"
                          top="50%"
                          right={layoutState.orderBook.visible ? -4 : 3.5}
                          zIndex={2}
                          marginTop={-2}
                        >
                          <IconButton
                            icon={
                              layoutState.orderBook.visible
                                ? 'ChevronRightSmallSolid'
                                : 'ChevronLeftSmallSolid'
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
                            hoverStyle={{
                              borderColor: '$border',
                            }}
                            pressStyle={{
                              borderColor: '$border',
                            }}
                            cursor="pointer"
                            onPress={toggleOrderBook}
                          />
                        </Stack>
                      ) : null}
                    </YStack>

                    {gtXl && layoutState.orderBook.visible ? (
                      <YStack
                        borderLeftWidth="$px"
                        borderLeftColor="$borderSubdued"
                        w={PERP_LAYOUT_CONFIG.orderBook.width}
                        height="100%"
                        overflow="hidden"
                      >
                        <PerpOrderBookResizable />
                      </YStack>
                    ) : null}
                  </XStack>
                </Allotment.Pane>

                <Allotment.Pane
                  minSize={
                    PERP_LAYOUT_CONFIG.enableAutoCollapse
                      ? 0
                      : PERP_LAYOUT_CONFIG.leftPanel.infoPanel.minHeight
                  }
                  snap={PERP_LAYOUT_CONFIG.enableAutoCollapse}
                >
                  <YStack height="100%">
                    <PerpOrderInfoPanel />
                  </YStack>
                </Allotment.Pane>
              </Allotment>
            </YStack>
          </Allotment.Pane>

          <Allotment.Pane
            minSize={PERP_LAYOUT_CONFIG.main.tradingMinWidth}
            maxSize={PERP_LAYOUT_CONFIG.main.tradingMaxWidth}
          >
            <YStack
              height="100%"
              minWidth={PERP_LAYOUT_CONFIG.main.tradingMinWidth}
              gap="$4"
              style={{ overflow: 'auto' }}
            >
              <PerpTradingPanel />
              <YStack borderTopWidth="$px" borderTopColor="$borderSubdued">
                <PerpAccountPanel />
                <PerpAccountDebugInfo />
              </YStack>
            </YStack>
          </Allotment.Pane>
        </Allotment>
      </Stack>
    </YStack>
  );
}

export { PerpDesktopLayout };
