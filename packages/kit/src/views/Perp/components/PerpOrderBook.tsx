import { SizableText, YStack } from '@onekeyhq/components';

import { useL2Book } from '../hooks/usePerpMarketData';

import { OrderBook } from './OrderBook';

export function PerpOrderBook() {
  const {
    l2Book,
    hasOrderBook,
    // getBestBid,
    // getBestAsk,
    // getSpread,
    // getSpreadPercent,
    // getTotalBidVolume,
    // getTotalAskVolume,
  } = useL2Book();

  if (!hasOrderBook || !l2Book) {
    return (
      <YStack flex={1} p="$4" justifyContent="center" alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          Loading order book...
        </SizableText>
      </YStack>
    );
  }

  // const bestBid = getBestBid();
  // const bestAsk = getBestAsk();
  // const spread = getSpread();
  // const spreadPercent = getSpreadPercent();

  return (
    <YStack flex={1} bg="$bgApp">
      <OrderBook
        horizontal={false}
        bids={l2Book.bids}
        asks={l2Book.asks}
        maxLevelsPerSide={11}
      />
    </YStack>
  );
}
