import { useState } from 'react';

import {
  IconButton,
  ScrollView,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';

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

function PerpDesktopLayout() {
  const { gtXl } = useMedia();
  const [isOrderBookVisible, setIsOrderBookVisible] = useState(true);
  return (
    <ScrollView flex={1}>
      <YStack bg="$bgApp">
        <PerpTips />
        <PerpTickerBar />
        <XStack flex={1}>
          <YStack
            flex={1}
            borderRightWidth="$px"
            borderRightColor="$borderSubdued"
            width="80%"
          >
            {/* Charts Section */}
            <XStack
              flex={7}
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
            >
              <YStack flex={1} minHeight={600} position="relative">
                <YStack flex={1} pr={6}>
                  <PerpCandles />
                </YStack>
                {gtXl ? (
                  <Stack
                    position="absolute"
                    top="50%"
                    right={isOrderBookVisible ? -4 : 3.5}
                    zIndex={2}
                    marginTop={-2}
                  >
                    <IconButton
                      icon={
                        isOrderBookVisible
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
                      onPress={() => setIsOrderBookVisible((prev) => !prev)}
                    />
                  </Stack>
                ) : null}
              </YStack>

              {gtXl && isOrderBookVisible ? (
                <YStack
                  borderLeftWidth="$px"
                  borderLeftColor="$borderSubdued"
                  w={270}
                >
                  <PerpOrderBook />
                </YStack>
              ) : null}
            </XStack>
            {/* Positions Section */}
            <YStack flex={1} overflow="hidden">
              <PerpOrderInfoPanel />
            </YStack>
          </YStack>
          <YStack minWidth={340} gap="$4" width="20%">
            <PerpTradingPanel />
            <YStack borderTopWidth="$px" borderTopColor="$borderSubdued">
              <PerpAccountPanel />
              <PerpAccountDebugInfo />
            </YStack>
          </YStack>
        </XStack>
      </YStack>
    </ScrollView>
  );
}

export { PerpDesktopLayout };
