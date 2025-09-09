import { ScrollView, SizableText, XStack, YStack } from '@onekeyhq/components';

import { useL2Book } from '../hooks/usePerpMarketData';

interface IOrderBookRowProps {
  px: string;
  sz: string;
  side: 'bid' | 'ask';
  index: number;
}

function OrderBookRow({ px, sz, side, index }: IOrderBookRowProps) {
  const isBid = side === 'bid';

  return (
    <XStack
      py="$1"
      px="$2"
      justifyContent="space-between"
      bg={index % 2 === 0 ? '$bgSubdued' : 'transparent'}
    >
      <SizableText
        size="$bodyMd"
        color={isBid ? '$textSuccess' : '$textCritical'}
        flex={1}
        textAlign="right"
        pr="$2"
      >
        {parseFloat(px).toFixed(2)}
      </SizableText>
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        flex={1}
        textAlign="right"
      >
        {parseFloat(sz).toFixed(4)}
      </SizableText>
    </XStack>
  );
}

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
        <XStack space="$2">
          <SizableText size="$bodyMd" color="$textSubdued">
            Spread: {spread ? spread.toFixed(2) : '--'}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            ({spreadPercent ? spreadPercent.toFixed(3) : '--'}%)
          </SizableText>
        </XStack>
      </XStack>

      {/* Column Headers */}
      <XStack
        px="$2"
        py="$1"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        justifyContent="space-between"
      >
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          flex={1}
          textAlign="right"
          pr="$2"
        >
          Price
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          flex={1}
          textAlign="right"
        >
          Size
        </SizableText>
      </XStack>

      <ScrollView flex={1}>
        <YStack>
          {/* Asks (sell orders) - reverse order, price from low to high */}
          {l2Book.asks
            .slice(0, 15)
            .reverse()
            .map((level, index) => (
              <OrderBookRow
                key={`ask-${level.px}-${index}`}
                px={level.px}
                sz={level.sz}
                side="ask"
                index={index}
              />
            ))}

          {/* Spread Indicator */}
          <XStack
            py="$2"
            px="$2"
            bg="$bgSubdued"
            justifyContent="center"
            alignItems="center"
            borderTopWidth="$px"
            borderBottomWidth="$px"
            borderColor="$borderSubdued"
          >
            <SizableText size="$bodyMd" fontWeight="600">
              {bestAsk || '--'} ↑
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued" mx="$2">
              /
            </SizableText>
            <SizableText size="$bodyMd" fontWeight="600">
              ↓ {bestBid || '--'}
            </SizableText>
          </XStack>

          {/* Bids (buy orders) - normal order, price from high to low */}
          {l2Book.bids.slice(0, 15).map((level, index) => (
            <OrderBookRow
              key={`bid-${level.px}-${index}`}
              px={level.px}
              sz={level.sz}
              side="bid"
              index={index}
            />
          ))}
        </YStack>
      </ScrollView>

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
