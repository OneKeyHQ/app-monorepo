import {
  EPageType,
  SizableText,
  XStack,
  YStack,
  usePageType,
} from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

export function TokenDetailHeader({
  tokenDetail,
}: {
  tokenDetail?: IMarketTokenDetail;
}) {
  const pageType = usePageType();

  const {
    activeAccount: { wallet: _wallet },
  } = useActiveAccount({
    num: 0,
  });

  const {
    name = '',
    symbol = '',
    price: currentPrice = '0',
    // coingeckoId, // TODO: uncomment when MarketStar is used
    // priceChangePercentage24h, // TODO: uncomment when PriceChangePercentage is used
  } = tokenDetail || {};

  return (
    <YStack
      bg="$green4"
      px="$5"
      $md={{ minHeight: 150 }}
      {...(pageType === EPageType.modal ? { minHeight: 150 } : null)}
    >
      <YStack flex={1}>
        <SizableText size="$headingMd" color="$textSubdued">
          {name}
        </SizableText>
        <XStack ai="center" jc="space-between" pt="$2">
          <MarketTokenPrice
            size="$heading3xl"
            price={currentPrice}
            tokenName={name}
            tokenSymbol={symbol}
            // lastUpdated={lastUpdated} // lastUpdated is not in IMarketTokenDetail from marketV2.ts
          />
          {/* <MarketStar
            coingeckoId={coinGeckoId}
            mr="$-2"
            size="medium"
            from={EWatchlistFrom.details}
          /> */}
        </XStack>
        {/* <PriceChangePercentage pt="$0.5" width="100%">
          {performance.priceChangePercentage24h}
        </PriceChangePercentage> */}
      </YStack>

      {/* {gtMd ? <MarketDetailOverview token={token} /> : null} */}
    </YStack>
  );
}
