import React from 'react';

import { XStack, YStack } from '@onekeyhq/components';

import { PerpTickerBar } from '../components/TickerBar/PerpTickerBar';
import { PerpTradingPanel } from '../components/TradingPanel/PerpTradingPanel';
import { PerpChartsSection } from '../components/Charts/PerpChartsSection';
import { PerpProtfolioPanel } from '../components/PerpProtfolioPanel';
import { PerpAccountPanel } from '../components/TradingPanel/PerpAccountPanel';
import { PerpOrderBook } from '../components/PerpOrderBook';

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
          <XStack
            flex={0.6}
            borderBottomWidth="$px"
            borderBottomColor="$borderSubdued"
            minHeight={400}
          >
            {/* Charts - 70% width */}
            <YStack flex={0.7}>
              <PerpChartsSection />
            </YStack>
            
            {/* Order Book - 30% width */}
            <YStack 
              flex={0.3} 
              borderLeftWidth="$px" 
              borderLeftColor="$borderSubdued"
              minWidth={300}
            >
              <PerpOrderBook />
            </YStack>
          </XStack>

          {/* Positions Section - Takes 40% of left side height */}
          <YStack flex={0.4} minHeight={300}>
            <PerpProtfolioPanel />
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