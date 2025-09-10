import { SizableText, XStack, YStack } from '@onekeyhq/components';

import { useL2Book } from '../hooks/usePerpMarketData';

import { OrderBook, OrderPairBook } from './OrderBook';

export function PerpOrderBook() {
  const {
    l2Book,
    hasOrderBook,
    getBestBid,
    getBestAsk,
    getSpread,
    getSpreadPercent,
    getTotalBidVolume,
    getTotalAskVolume,
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

  const bestBid = getBestBid();
  const bestAsk = getBestAsk();
  const spread = getSpread();
  const spreadPercent = getSpreadPercent();

  return (
    <YStack flex={1} bg="$bgApp">
      {/* Header */}
      <XStack
        p="$3"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        justifyContent="space-between"
        alignItems="center"
      >
        <SizableText size="$headingSm" fontWeight="600">
          Order Book
        </SizableText>
        <XStack gap="$2">
          <SizableText size="$bodyMd" color="$textSubdued">
            Spread: {spread ? spread.toFixed(2) : '--'}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            ({spreadPercent ? spreadPercent.toFixed(3) : '--'}%)
          </SizableText>
        </XStack>
      </XStack>

      <OrderBook
        horizontal={false}
        bids={l2Book.bids.map((bid) => ({
          price: Number(bid.px),
          size: Number(bid.sz),
          cumSize: 0,
        }))}
        asks={l2Book.asks.map((ask) => ({
          price: Number(ask.px),
          size: Number(ask.sz),
          cumSize: 0,
        }))}
        maxLevelsPerSide={15}
      />

      {/* Footer Stats */}
      <XStack
        p="$2"
        borderTopWidth="$px"
        borderTopColor="$borderSubdued"
        justifyContent="space-between"
        bg="$bgSubdued"
      >
        <SizableText size="$bodyMd" color="$textSuccess">
          Bid Volume: {getTotalBidVolume(5).toFixed(2)}
        </SizableText>
        <SizableText size="$bodyMd" color="$textCritical">
          Ask Volume: {getTotalAskVolume(5).toFixed(2)}
        </SizableText>
      </XStack>
    </YStack>
  );
}
