import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { MarketStarV2 } from '../../../components/MarketStarV2';

interface ITokenDetailHeaderRightProps {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
  showStats: boolean;
}

export function TokenDetailHeaderRight({
  tokenDetail,
  networkId,
  showStats,
}: ITokenDetailHeaderRightProps) {
  const {
    name = '',
    symbol = '',
    price: currentPrice = '0',
    priceChange24hPercent = '0',
    marketCap = '0',
    volume24h = '0',
    holders = 0,
    address = '',
  } = tokenDetail || {};

  const priceChangeNum = parseFloat(priceChange24hPercent);
  const isPriceUp = priceChangeNum >= 0;

  if (!showStats) {
    return networkId && address ? (
      <MarketStarV2
        chainId={networkId}
        contractAddress={address}
        mr="$-2"
        size="medium"
        from={EWatchlistFrom.details}
      />
    ) : null;
  }

  return (
    <XStack gap="$6" pt="$2">
      {/* Price and Price Change */}
      <YStack ai="center" jc="space-between">
        <MarketTokenPrice
          size="$bodyLgMedium"
          price={currentPrice}
          tokenName={name}
          tokenSymbol={symbol}
        />
        <XStack ai="center">
          <SizableText
            size="$bodyMdMedium"
            color={isPriceUp ? '$textSuccess' : '$textCritical'}
          >
            {isPriceUp ? '+' : ''}
            {priceChange24hPercent.slice(0, 6)}%
          </SizableText>
        </XStack>
      </YStack>

      <YStack gap="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          Market cap
        </SizableText>
        <SizableText size="$bodyMdMedium" color="$text">
          ${numberFormat(marketCap, { formatter: 'marketCap' })}
        </SizableText>
      </YStack>

      <YStack gap="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          Liquidity
        </SizableText>
        <SizableText size="$bodyMdMedium" color="$text">
          ${numberFormat(volume24h, { formatter: 'marketCap' })}
        </SizableText>
      </YStack>

      <YStack gap="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          Holders
        </SizableText>
        <SizableText size="$bodyMdMedium" color="$text">
          {numberFormat(String(holders), { formatter: 'marketCap' })}
        </SizableText>
      </YStack>

      {networkId && address ? (
        <MarketStarV2
          chainId={networkId}
          contractAddress={address}
          mr="$-2"
          size="medium"
          from={EWatchlistFrom.details}
        />
      ) : null}
    </XStack>
  );
}
