import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { MarketStarV2 } from '../../../components/MarketStarV2';

import { ShareButton } from './ShareButton';

interface IStatItemProps {
  label: string;
  value: string;
}

function StatItem({ label, value }: IStatItemProps) {
  return (
    <YStack gap="$1">
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodySmMedium" color="$text">
        {value}
      </SizableText>
    </YStack>
  );
}

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
  const intl = useIntl();

  const {
    name = '',
    symbol = '',
    price: currentPrice = '0',
    priceChange24hPercent = '0',
    marketCap = '0',
    tvl = '0',
    holders = 0,
    address = '',
  } = tokenDetail || {};

  const marketStar =
    networkId && address ? (
      <MarketStarV2
        chainId={networkId}
        contractAddress={address}
        size="medium"
        from={EWatchlistFrom.details}
      />
    ) : null;

  const shareButton =
    networkId && address ? (
      <ShareButton networkId={networkId} address={address} />
    ) : null;

  if (!showStats) {
    return (
      <XStack gap="$3" ai="center">
        {shareButton}
        {marketStar}
      </XStack>
    );
  }

  return (
    <XStack gap="$6" ai="center">
      {/* Price and Price Change */}
      <YStack ai="flex-end" jc="space-between" mt="$-0.5">
        <MarketTokenPrice
          size="$bodyLgMedium"
          price={currentPrice}
          tokenName={name}
          tokenSymbol={symbol}
        />
        <PriceChangePercentage size="$bodySm">
          {priceChange24hPercent}
        </PriceChangePercentage>
      </YStack>

      <StatItem
        label={intl.formatMessage({ id: ETranslations.dexmarket_market_cap })}
        value={`$${String(
          numberFormat(marketCap, { formatter: 'marketCap' }),
        )}`}
      />

      <StatItem
        label={intl.formatMessage({ id: ETranslations.dexmarket_liquidity })}
        value={`$${String(numberFormat(tvl, { formatter: 'marketCap' }))}`}
      />

      <StatItem
        label={intl.formatMessage({ id: ETranslations.dexmarket_holders })}
        value={String(
          numberFormat(String(holders), { formatter: 'marketCap' }),
        )}
      />

      {shareButton}
      {marketStar}
    </XStack>
  );
}
