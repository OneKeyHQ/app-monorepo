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
import { usePerpsLayoutStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { PerpOrderInfoPanel } from '../components/OrderInfoPanel/PerpOrderInfoPanel';
import { PerpCandles } from '../components/PerpCandles';
import { PerpOrderBookResizable } from '../components/PerpOrderBookResizable';
import { PerpTips } from '../components/PerpTips';
import { PerpTickerBar } from '../components/TickerBar/PerpTickerBar';
import {
  PerpAccountDebugInfo,
  PerpAccountPanel,
} from '../components/TradingPanel/panels/PerpAccountPanel';
import { PerpTradingPanel } from '../components/TradingPanel/PerpTradingPanel';

import type { AllotmentHandle } from 'allotment';

const LAYOUT_CONFIG = {
  enableAutoCollapse: false,
  main: {
    marketMinWidth: 400,
    tradingMinWidth: 300,
    tradingMaxWidth: 800,
  },
  leftPanel: {
    charts: {
      minHeight: 400,
      collapseThreshold: 350,
    },
    infoPanel: {
      minHeight: 200,
      collapseThreshold: 180,
    },
  },
  orderBook: {
    width: 250,
  },
} as const;

function PerpDesktopLayout() {
  const { gtXl } = useMedia();
  const leftPanelAllotmentRef = useRef<AllotmentHandle>(null);
  const isInitializedRef = useRef(false);

  const [layoutState, setLayoutState] = usePerpsLayoutStateAtom();

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

  const handleMainChange = useCallback(
    (sizes: number[]) => {
      if (!isInitializedRef.current) {
        return;
      }

      const totalSize = sizes[0] + sizes[1];
      const marketRatioPercent = (sizes[0] / totalSize) * 100;

      setLayoutState((prev) => ({
        ...prev,
        main: { marketRatio: marketRatioPercent },
      }));
    },
    [setLayoutState],
  );

  const handleMainChangeDebounced = useMemo(
    () => debounce(handleMainChange, 500),
    [handleMainChange],
  );

  const handleLeftPanelChangeCore = useCallback(
    (sizes: number[]) => {
      if (!isInitializedRef.current) {
        return;
      }

      const totalSize = sizes[0] + sizes[1];
      const chartsRatioPercent = (sizes[0] / totalSize) * 100;

      setLayoutState((prev) => ({
        ...prev,
        leftPanel: { chartsRatio: chartsRatioPercent },
      }));
    },
    [setLayoutState],
  );

  const handleLeftPanelChangeDebounced = useMemo(
    () => debounce(handleLeftPanelChangeCore, 500),
    [handleLeftPanelChangeCore],
  );

  const handleLeftPanelChange = useCallback(
    (sizes: number[]) => {
      handleLeftPanelChangeDebounced(sizes);

      if (!LAYOUT_CONFIG.enableAutoCollapse) return;

      const chartsSize = sizes[0];
      const infoPanelSize = sizes[1];

      let needsUpdate = false;
      let newChartsSize = chartsSize;
      let newInfoPanelSize = infoPanelSize;

      if (
        chartsSize > 0 &&
        chartsSize < LAYOUT_CONFIG.leftPanel.charts.collapseThreshold
      ) {
        newChartsSize = 0;
        newInfoPanelSize = chartsSize + infoPanelSize;
        needsUpdate = true;
      }

      if (
        infoPanelSize > 0 &&
        infoPanelSize < LAYOUT_CONFIG.leftPanel.infoPanel.collapseThreshold
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

  return (
    <YStack flex={1} bg="$bgApp">
      <YStack>
        <PerpTips />
        <PerpTickerBar />
      </YStack>

      <Stack flex={1} display="flex">
        <Allotment
          defaultSizes={mainSizes}
          onChange={handleMainChangeDebounced}
        >
          <Allotment.Pane minSize={LAYOUT_CONFIG.main.marketMinWidth}>
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
                    LAYOUT_CONFIG.enableAutoCollapse
                      ? 0
                      : LAYOUT_CONFIG.leftPanel.charts.minHeight
                  }
                  snap={LAYOUT_CONFIG.enableAutoCollapse}
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
                        w={LAYOUT_CONFIG.orderBook.width}
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
                    LAYOUT_CONFIG.enableAutoCollapse
                      ? 0
                      : LAYOUT_CONFIG.leftPanel.infoPanel.minHeight
                  }
                  snap={LAYOUT_CONFIG.enableAutoCollapse}
                >
                  <YStack height="100%">
                    <PerpOrderInfoPanel />
                  </YStack>
                </Allotment.Pane>
              </Allotment>
            </YStack>
          </Allotment.Pane>

          <Allotment.Pane
            minSize={LAYOUT_CONFIG.main.tradingMinWidth}
            maxSize={LAYOUT_CONFIG.main.tradingMaxWidth}
          >
            <YStack
              height="100%"
              minWidth={LAYOUT_CONFIG.main.tradingMinWidth}
              overflow="scroll"
              gap="$4"
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
