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
    <ScrollView>
      <YStack flex={1} bg="$bgApp">
        <PerpTickerBar />
        <XStack flex={1}>
          <YStack
            flex={1}
            borderRightWidth="$px"
            borderRightColor="$borderSubdued"
            minWidth={gtXl ? 800 : 400}
          >
            {/* Charts Section - Takes 60% of left side height */}
            <XStack
              flex={gtXl ? 1 : 0.6}
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
              minHeight={400}
            >
              {/* Charts - 70% width */}
              <YStack flex={gtXl ? 0.7 : 1}>
                <PerpCandles />
              </YStack>

              {/* Order Book - 30% width */}
              {gtXl ? (
                <YStack
                  flex={0.3}
                  borderLeftWidth="$px"
                  borderLeftColor="$borderSubdued"
                  minWidth={300}
                >
                  <PerpOrderBook />
                </YStack>
              ) : null}
            </XStack>

            {/* Positions Section - Takes 40% of left side height */}
            <YStack flex={0.4} minHeight={300}>
              <PerpOrderInfoPanel />
            </YStack>
          </YStack>

          {/* Right Section: Trading Panel */}
          <YStack maxWidth={400} minWidth={320}>
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
