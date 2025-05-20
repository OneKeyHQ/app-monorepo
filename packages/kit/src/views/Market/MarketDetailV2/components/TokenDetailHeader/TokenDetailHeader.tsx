import {
  EPageType,
  SizableText,
  XStack,
  YStack,
  useMedia,
  usePageType,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { MarketDetailOverview } from '@onekeyhq/kit/src/views/Market/components/MarketDetailOverview';
import { MarketStar } from '@onekeyhq/kit/src/views/Market/components/MarketStar';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { MarketTradeButton } from '@onekeyhq/kit/src/views/Market/components/MarketTradeButton';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

export function TokenDetailHeader({
  coinGeckoId,
  token: responseToken,
}: {
  coinGeckoId: string;
  token: IMarketTokenDetail;
}) {
  const { gtMd: gtMdMedia } = useMedia();

  const pageType = usePageType();

  const {
    activeAccount: { wallet },
  } = useActiveAccount({
    num: 0,
  });

  const gtMd = pageType === EPageType.modal ? false : gtMdMedia;

  const { result: token } = usePromiseResult(
    () => backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(coinGeckoId),
    [coinGeckoId],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 45 }),
      initResult: responseToken,
    },
  );
  const {
    name,
    symbol,
    stats: { performance, currentPrice, lastUpdated },
  } = token;
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
            lastUpdated={lastUpdated}
          />
          <MarketStar
            coingeckoId={coinGeckoId}
            mr="$-2"
            size="medium"
            from={EWatchlistFrom.details}
          />
        </XStack>
        <PriceChangePercentage pt="$0.5" width="100%">
          {performance.priceChangePercentage24h}
        </PriceChangePercentage>
      </YStack>
      <MarketTradeButton
        coinGeckoId={coinGeckoId}
        token={token}
        wallet={wallet}
      />
      {gtMd ? <MarketDetailOverview token={token} /> : null}
    </YStack>
  );
}
