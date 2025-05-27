import {
  EPageType,
  Icon,
  SizableText,
  XStack,
  YStack,
  useClipboard,
  usePageType,
} from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { MarketStar } from '../../../components/MarketStar';

export function TokenDetailHeader({
  tokenDetail,
}: {
  tokenDetail?: IMarketTokenDetail;
}) {
  const pageType = usePageType();
  const { copyText } = useClipboard();

  const {
    activeAccount: { wallet: _wallet },
  } = useActiveAccount({
    num: 0,
  });

  const {
    name = '',
    symbol = '',
    price: currentPrice = '0',
    priceChange24hPercent = '0',
    marketCap = '0',
    volume24h = '0', // Using volume24h as liquidity
    holders = 0,
    address = '',
  } = tokenDetail || {};

  const handleCopyAddress = () => {
    if (address) {
      copyText(address);
    }
  };

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const priceChangeNum = parseFloat(priceChange24hPercent);
  const isPriceUp = priceChangeNum >= 0;

  return (
    <XStack width="100%" px="$5" pt="$4" pb="$2" jc="space-between">
      {/* Token Symbol and Address */}
      <XStack ai="center" gap="$2">
        <SizableText size="$heading2xl" color="$text">
          {symbol}
        </SizableText>
        {address ? (
          <XStack
            ai="center"
            gap="$1"
            px="$2"
            py="$1"
            bg="$bgSubdued"
            borderRadius="$2"
            onPress={handleCopyAddress}
            cursor="pointer"
            hoverStyle={{ bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
          >
            <SizableText size="$bodySm" color="$textSubdued">
              {formatAddress(address)}
            </SizableText>
            <Icon name="Copy1Outline" size="$4" color="$iconSubdued" />
          </XStack>
        ) : null}
      </XStack>

      {/* Price and Price Change */}
      <YStack ai="center" jc="space-between">
        <MarketTokenPrice
          size="$heading3xl"
          price={currentPrice}
          tokenName={name}
          tokenSymbol={symbol}
        />
        <XStack
          ai="center"
          px="$2"
          py="$1"
          bg={isPriceUp ? '$bgSuccessSubdued' : '$bgCriticalSubdued'}
          borderRadius="$2"
        >
          <SizableText
            size="$bodyMdMedium"
            color={isPriceUp ? '$textSuccess' : '$textCritical'}
          >
            {isPriceUp ? '+' : ''}
            {priceChange24hPercent}%
          </SizableText>
        </XStack>
      </YStack>

      {/* Market Stats */}
      <XStack gap="$6" pt="$2">
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

        <MarketStar
          coingeckoId={symbol}
          mr="$-2"
          size="medium"
          from={EWatchlistFrom.details}
        />
      </XStack>
    </XStack>
  );
}
