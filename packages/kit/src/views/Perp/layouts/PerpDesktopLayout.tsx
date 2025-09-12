import { ScrollView, XStack, YStack, useMedia } from '@onekeyhq/components';

import { PerpOrderInfoPanel } from '../components/OrderInfoPanel/PerpOrderInfoPanel';
import { PerpCandles } from '../components/PerpCandles';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { PerpTickerBar } from '../components/TickerBar/PerpTickerBar';
import { PerpAccountPanel } from '../components/TradingPanel/PerpAccountPanel';
import { PerpTradingPanel } from '../components/TradingPanel/PerpTradingPanel';

function PerpDesktopLayout() {
  const { gtXl } = useMedia();
  return (
    <ScrollView flex={1}>
      <YStack bg="$bgApp">
        <PerpTickerBar />
        <XStack flex={1}>
          <YStack
            flex={1}
            borderRightWidth="$px"
            borderRightColor="$borderSubdued"
          >
            {/* Charts Section */}
            <XStack
              flex={7}
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
            >
              <YStack flex={1} minHeight={300}>
                <PerpCandles />
              </YStack>

              {gtXl ? (
                <YStack
                  borderLeftWidth="$px"
                  borderLeftColor="$borderSubdued"
                  w={300}
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
          <YStack w={360}>
            <PerpTradingPanel />
            <YStack borderTopWidth="$px" borderTopColor="$borderSubdued">
              <PerpAccountPanel />
            </YStack>
          </YStack>
        </XStack>
      </YStack>
    </ScrollView>
  );
}

export { PerpDesktopLayout };
