import { useCallback, useMemo, useRef } from 'react';

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

import { calculateMaxLevelsPerSide } from './perpLayoutUtils';

function PerpDesktopLayout() {
  const intl = useIntl();
  const { gtXl } = useMedia();
  const [layoutState, setLayoutState] = usePerpsLayoutStateAtom();
  const scrollContainerRef = useRef<HTMLElement>(null);

  const layout = PERP_LAYOUT_CONFIG.desktop;

  const showOrderBook = gtXl && (layoutState.orderBook?.visible ?? true);
  const tradingWidth = layout.widths.trading;
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
      orderBook: { visible: !(prev.orderBook?.visible ?? true) },
    }));
  }, [setLayoutState]);
  const handleTradingViewTouchScroll = useCallback((deltaY: number) => {
    scrollContainerRef.current?.scrollBy({ top: deltaY });
  }, []);

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
        <YStack pb="$4">
          <PerpAccountPanel />
          <PerpAccountDebugInfo />
        </YStack>
      </YStack>
    );
  }, [intl, tradingWidth]);

  return (
    <Stack
      ref={scrollContainerRef as any}
      flex={1}
      style={{ overflowY: 'auto' }}
    >
      <YStack>
        <PerpTips />
        <FavoritesBar />

        <YStack borderBottomWidth="$px" borderBottomColor="$borderSubdued">
          <PerpTickerBar />

          <XStack h={layout.marketContentHeight} overflow="hidden">
            <YStack flex={1} minWidth={PERP_LAYOUT_CONFIG.main.marketMinWidth}>
              <XStack flex={1} overflow="hidden">
                <YStack flex={1} position="relative">
                  <PerpCandles onTouchScroll={handleTradingViewTouchScroll} />

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
                      <SizableText size="$bodyMdMedium">
                        {intl.formatMessage({
                          id: ETranslations.perps_order_book,
                        })}
                      </SizableText>
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
            borderTopWidth="$px"
            borderTopColor="$borderSubdued"
            minHeight={layout.bottomPanelHeight}
          >
            <YStack flex={1}>
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
