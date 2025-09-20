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

        <XStack alignItems="stretch">
          <YStack flex={4} pl="$4" pt="$4">
            <PerpOrderBook />
          </YStack>
          <YStack flex={6}>
            <PerpTradingPanel isMobile />
          </YStack>
        </XStack>

        <YStack borderTopWidth="$px" borderTopColor="$borderSubdued">
          <PerpOrderInfoPanel isMobile />
        </YStack>
      </YStack>
    </ScrollView>
  );
}
