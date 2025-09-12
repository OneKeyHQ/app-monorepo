import { useCallback, useEffect, useRef, useState } from 'react';

import { SizableText, YStack } from '@onekeyhq/components';

import { useL2Book } from '../hooks/usePerpMarketData';

import { OrderBook } from './OrderBook';
import { useTickOptions } from './OrderBook/useTickOptions';

import type { ITickParam } from './OrderBook/tickSizeUtils';

export function PerpOrderBook() {
  const [selectedTickOption, setSelectedTickOption] = useState<ITickParam>();
  const prevSymbolRef = useRef<string | undefined>(undefined);
  const {
    l2Book,
    hasOrderBook,
    // getBestBid,
    // getBestAsk,
    // getSpread,
    // getSpreadPercent,
    // getTotalBidVolume,
    // getTotalAskVolume,
  } = useL2Book({
    nSigFigs: selectedTickOption?.nSigFigs || null,
    mantissa: selectedTickOption?.mantissa,
  });

  const tickOptionsData = useTickOptions({
    symbol: l2Book?.coin,
    bids: l2Book?.bids ?? [],
    asks: l2Book?.asks ?? [],
  });

  useEffect(() => {
    // Only reset when symbol changes or when initially setting
    if (
      (prevSymbolRef.current !== l2Book?.coin || !selectedTickOption) &&
      tickOptionsData.defaultTickOption
    ) {
      setSelectedTickOption(tickOptionsData.defaultTickOption);
      prevSymbolRef.current = l2Book?.coin;
    }
  }, [l2Book?.coin, tickOptionsData.defaultTickOption, selectedTickOption]);

  const handleTickOptionChange = useCallback((option: ITickParam) => {
    setSelectedTickOption(option);
  }, []);

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
        symbol={l2Book.coin}
        horizontal={false}
        bids={l2Book.bids}
        asks={l2Book.asks}
        maxLevelsPerSide={16}
        selectedTickOption={selectedTickOption}
        onTickOptionChange={handleTickOptionChange}
        tickOptions={tickOptionsData.tickOptions}
        showTickSelector
        priceDecimals={tickOptionsData.priceDecimals}
        sizeDecimals={tickOptionsData.sizeDecimals}
      />
    </YStack>
  );
}
