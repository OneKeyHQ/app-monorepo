import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { usePerpsLayoutStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { FavoritesBar } from '../components/FavoritesBar/FavoritesBar.web';
import { PerpOrderInfoPanel } from '../components/OrderInfoPanel/PerpOrderInfoPanel';
import { PerpCandles } from '../components/PerpCandles';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { PerpTips } from '../components/PerpTips';
import { PerpTickerBar } from '../components/TickerBar/PerpTickerBar';
import {
  PerpAccountDebugInfo,
  PerpAccountPanel,
} from '../components/TradingPanel/panels/PerpAccountPanel';
import { PerpTradingPanel } from '../components/TradingPanel/PerpTradingPanel';

function calculateMaxLevelsPerSide(containerHeight: number): number {
  // We want to minimize visible "blank" space at the bottom of the order book.
  // The vertical web order book renders:
  // - Root padding: 1px top + 1px bottom (2px)
  // - Table header (Price/Size/Total): 24px
  // - Spread row: 24px + 1px marginTop (25px)
  // - Each level row: 24px + 1px marginTop (25px)
  //
  // Total height: baseHeight(51px) + 2 * levelsPerSide * 25px
  const baseHeight = 2 + 24 + 25;
  const levelRowStep = 25;

  if (containerHeight <= 0) return 11;
  if (containerHeight <= baseHeight) return 3;

  let levelsPerSide = Math.floor(
    (containerHeight - baseHeight) / (2 * levelRowStep),
  );
  levelsPerSide = Math.max(3, Math.min(levelsPerSide, 50));

  // If we have a noticeable gap, prefer one extra level and accept a tiny clip
  // instead of showing empty space.
  const usedHeight = baseHeight + 2 * levelsPerSide * levelRowStep;
  const blank = containerHeight - usedHeight;
  if (blank > levelRowStep / 2 && levelsPerSide < 50) {
    levelsPerSide += 1;
  }

  return levelsPerSide;
}

function PerpDesktopLayout() {
  const intl = useIntl();
  const { gtXl } = useMedia();
  const [layoutState, setLayoutState] = usePerpsLayoutStateAtom();

  const layout = PERP_LAYOUT_CONFIG.desktop;

  const showOrderBook = gtXl && layoutState.orderBook.visible;
  const tradingWidth = gtXl ? layout.widths.tradingXl : layout.widths.trading;
  const orderBookMaxLevelsPerSide = useMemo(
    () =>
      calculateMaxLevelsPerSide(
        layout.marketContentHeight - layout.panelHeaderHeight,
      ),
    [layout.marketContentHeight, layout.panelHeaderHeight],
  );

  const toggleOrderBook = useCallback(() => {
    setLayoutState((prev) => ({
      ...prev,
      orderBook: { visible: !prev.orderBook.visible },
    }));
  }, [setLayoutState]);

  const tradingPanel = useMemo(() => {
    return (
      <YStack
        h={layout.marketContentHeight}
        minWidth={PERP_LAYOUT_CONFIG.main.tradingMinWidth}
        maxWidth={PERP_LAYOUT_CONFIG.main.tradingMaxWidth}
        w={tradingWidth}
        borderLeftWidth="$px"
        borderLeftColor="$borderSubdued"
      >
        <Stack flex={1} style={{ overflowY: 'auto' }}>
          <YStack pb="$4">
            <PerpTradingPanel />
          </YStack>
        </Stack>
      </YStack>
    );
  }, [layout.marketContentHeight, tradingWidth]);

  const accountPanel = useMemo(() => {
    return (
      <YStack
        h={layout.bottomPanelHeight}
        minWidth={PERP_LAYOUT_CONFIG.main.tradingMinWidth}
        maxWidth={PERP_LAYOUT_CONFIG.main.tradingMaxWidth}
        w={tradingWidth}
        borderLeftWidth="$px"
        borderLeftColor="$borderSubdued"
      >
        <XStack alignItems="center">
          <XStack py="$3" px="$2.5">
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: ETranslations.perp_trade_account_overview,
              })}
            </SizableText>
          </XStack>
        </XStack>
        <Stack flex={1} style={{ overflowY: 'auto' }}>
          <YStack pb="$4">
            <PerpAccountPanel />
            <PerpAccountDebugInfo />
          </YStack>
        </Stack>
      </YStack>
    );
  }, [
    intl,
    layout.bottomPanelHeaderHeight,
    layout.bottomPanelHeight,
    tradingWidth,
  ]);

  return (
    <Stack flex={1} style={{ overflowY: 'auto' }}>
      <YStack>
        <PerpTips />
        <FavoritesBar />

        <YStack borderBottomWidth="$px" borderBottomColor="$borderSubdued">
          <PerpTickerBar />

          <XStack h={layout.marketContentHeight} overflow="hidden">
            <YStack flex={1} minWidth={PERP_LAYOUT_CONFIG.main.marketMinWidth}>
              <XStack flex={1} overflow="hidden">
                <YStack flex={1} position="relative">
                  <PerpCandles />

                  {gtXl ? (
                    <Stack
                      position="absolute"
                      top="50%"
                      right={showOrderBook ? -4 : 3.5}
                      zIndex={2}
                      marginTop={-2}
                    >
                      <IconButton
                        icon={
                          showOrderBook
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
                  ) : null}
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
                      <SizableText size="$bodyMdMedium">Order Book</SizableText>
                    </XStack>
                    <YStack flex={1} overflow="hidden">
                      <PerpOrderBook
                        maxLevelsPerSide={orderBookMaxLevelsPerSide}
                      />
                    </YStack>
                  </YStack>
                ) : null}
              </XStack>
            </YStack>

            {tradingPanel}
          </XStack>

          <XStack
            h={layout.bottomPanelHeight}
            borderTopWidth="$px"
            borderTopColor="$borderSubdued"
            overflow="hidden"
          >
            <YStack flex={1} h="100%">
              <PerpOrderInfoPanel />
            </YStack>
            {accountPanel}
          </XStack>
        </YStack>
      </YStack>
    </Stack>
  );
}

export { PerpDesktopLayout };
