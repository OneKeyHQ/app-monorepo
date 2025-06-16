import {
  Icon,
  IconButton,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { MarketStar } from '../../../components/MarketStar';
import { TokenSecurityAlert } from '../TokenSecurityAlert';

export function TokenDetailHeader({
  tokenDetail,
  networkId,
}: {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
}) {
  const { copyText } = useClipboard();

  const {
    activeAccount: { wallet: _wallet },
  } = useActiveAccount({
    num: 0,
  });

  const { result: network } = usePromiseResult(
    () =>
      networkId
        ? backgroundApiProxy.serviceNetwork.getNetwork({ networkId })
        : Promise.resolve(undefined),
    [networkId],
    {
      checkIsFocused: false,
      overrideIsFocused: () => false,
    },
  );

  const {
    name = '',
    symbol = '',
    price: currentPrice = '0',
    priceChange24hPercent = '0',
    marketCap = '0',
    volume24h = '0', // Using volume24h as liquidity
    holders = 0,
    address = '',
    logoUrl = '',
    extraData,
  } = tokenDetail || {};

  const { website, twitter } = extraData || {};

  const handleCopyAddress = () => {
    if (address) {
      copyText(address);
    }
  };

  const handleOpenWebsite = () => {
    if (website) {
      openUrlExternal(website);
    }
  };

  const handleOpenTwitter = () => {
    if (twitter) {
      openUrlExternal(twitter);
    }
  };

  const priceChangeNum = parseFloat(priceChange24hPercent);
  const isPriceUp = priceChangeNum >= 0;

  return (
    <XStack width="100%" px="$5" pt="$4" pb="$2" jc="space-between">
      {/* Token Symbol and Address */}
      <XStack ai="center" gap="$2">
        <Token
          tokenImageUri={logoUrl}
          networkImageUri={network?.logoURI}
          fallbackIcon="CryptoCoinOutline"
        />

        <YStack>
          <SizableText size="$heading2xl" color="$text">
            {symbol}
          </SizableText>

          <XStack gap="$1" ai="center">
            {address ? (
              <XStack
                ai="center"
                gap="$1"
                onPress={handleCopyAddress}
                cursor="pointer"
                hoverStyle={{ bg: '$bgHover' }}
                pressStyle={{ bg: '$bgActive' }}
              >
                <SizableText size="$bodySm" color="$textSubdued">
                  {accountUtils.shortenAddress({
                    address,
                    leadingLength: 6,
                    trailingLength: 4,
                  })}
                </SizableText>

                <Icon name="Copy1Outline" size="$4" color="$iconSubdued" />
              </XStack>
            ) : null}

            {/* Social Links */}
            <XStack ai="center" gap="$2" mt="$1">
              {tokenDetail?.address && networkId ? (
                <TokenSecurityAlert
                  tokenAddress={tokenDetail?.address}
                  networkId={networkId}
                />
              ) : null}

              {website ? (
                <IconButton
                  size="small"
                  icon="GlobusOutline"
                  onPress={handleOpenWebsite}
                  variant="tertiary"
                />
              ) : null}
              {twitter ? (
                <IconButton
                  size="small"
                  icon="Xbrand"
                  onPress={handleOpenTwitter}
                  variant="tertiary"
                />
              ) : null}
            </XStack>
          </XStack>
        </YStack>
      </XStack>

      {/* Market Stats */}
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
