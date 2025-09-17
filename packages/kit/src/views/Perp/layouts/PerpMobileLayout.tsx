import { ScrollView, XStack, YStack } from '@onekeyhq/components';

import { PerpOrderInfoPanel } from '../components/OrderInfoPanel/PerpOrderInfoPanel';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { PerpTickerBar } from '../components/TickerBar/PerpTickerBar';
import { PerpTradingPanel } from '../components/TradingPanel/PerpTradingPanel';

export function PerpMobileLayout() {
  return (
    <ScrollView flex={1}>
      <YStack bg="$bgApp">
        <PerpTickerBar />

        <XStack gap="$3" alignItems="stretch">
          <YStack flex={1}>
            <PerpTradingPanel />
          </YStack>
          <YStack w={161} pr="$5" pl="$0">
            <PerpOrderBook />
          </YStack>
        </XStack>

        <YStack mt="$5">
          <PerpOrderInfoPanel isMobile />
        </YStack>
      </YStack>
    </ScrollView>
  );
}
