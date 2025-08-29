import { XStack, YStack } from '@onekeyhq/components';

import { PerpChartsSection } from '../components/Charts/PerpChartsSection';
import { PerpOrderInfoPanel } from '../components/OrderInfoPanel/PerpOrderInfoPanel';
import { PerpTickerBar } from '../components/TickerBar/PerpTickerBar';
import { PerpAccountPanel } from '../components/TradingPanel/PerpAccountPanel';
import { PerpTradingPanel } from '../components/TradingPanel/PerpTradingPanel';

function PerpDesktopLayout() {
  return (
    <YStack flex={1} bg="$bgApp">
      <PerpTickerBar />

      <XStack flex={1}>
        <YStack
          flex={1}
          borderRightWidth="$px"
          borderRightColor="$borderSubdued"
          minWidth={800}
        >
          {/* Charts Section - Takes 60% of left side height */}
          <YStack
            flex={0.6}
            borderBottomWidth="$px"
            borderBottomColor="$borderSubdued"
            minHeight={400}
          >
            <PerpChartsSection />
          </YStack>

          {/* Positions Section - Takes 40% of left side height */}
          <YStack flex={0.4} minHeight={300}>
            <PerpOrderInfoPanel />
          </YStack>
        </YStack>

        {/* Right Section: Trading Panel */}
        <YStack width={400} maxWidth={400} minWidth={400}>
          <PerpTradingPanel />
          <YStack borderTopWidth="$px" borderTopColor="$borderSubdued">
            <PerpAccountPanel />
          </YStack>
        </YStack>
      </XStack>
    </YStack>
  );
}

export { PerpDesktopLayout };
