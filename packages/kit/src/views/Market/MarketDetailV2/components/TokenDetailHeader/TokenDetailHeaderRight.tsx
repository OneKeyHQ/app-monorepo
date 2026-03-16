import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { STAT_FALLBACK_VALUE, normalizeStatValue } from '../../utils/statValue';

import { ShareButton } from './ShareButton';

interface IStatItemProps {
  label: string;
  value: React.ReactNode;
}

function StatItem({ label, value }: IStatItemProps) {
  return (
    <YStack>
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      {value}
    </YStack>
  );
}

interface ITokenDetailHeaderRightProps {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
  isNative?: boolean;
  showStats: boolean;
}

export function TokenDetailHeaderRight({
  tokenDetail,
  networkId,
  isNative,
  showStats,
}: ITokenDetailHeaderRightProps) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const {
    name = '',
    symbol = '',
    price: currentPrice = '--',
    priceConverted,
    priceChange24hPercent = '--',
    marketCap = '0',
    liquidity = '0',
    holders = 0,
    address = '',
  } = tokenDetail || {};

  const marketCapValue = normalizeStatValue(marketCap) ?? STAT_FALLBACK_VALUE;
  const liquidityValue = normalizeStatValue(liquidity) ?? STAT_FALLBACK_VALUE;
  const holdersValue = normalizeStatValue(holders) ?? STAT_FALLBACK_VALUE;

  const shareButton =
    networkId && platformEnv.isNative ? (
      <ShareButton
        networkId={networkId}
        address={address}
        isNative={isNative}
      />
    ) : null;

  if (!showStats) {
    return shareButton ? <XStack gap="$3">{shareButton}</XStack> : null;
  }

  return (
    <XStack gap="$8" ai="center">
      {/* Price and Price Change */}
      <XStack ai="center" gap="$1.5">
        <XStack ai="center" jc="center" gap="$3">
          <YStack ai="flex-end">
            <MarketTokenPrice
              size="$bodyLgMedium"
              price={currentPrice}
              tokenName={name}
              tokenSymbol={symbol}
              lastUpdated={tokenDetail?.lastUpdated?.toString()}
            />
            {priceConverted ? (
              <NumberSizeableText
                size="$bodySm"
                color="$textSubdued"
                formatter="price"
                formatterOptions={{ currency: currencyInfo.symbol }}
              >
                {priceConverted}
              </NumberSizeableText>
            ) : null}
          </YStack>

          <PriceChangePercentage size="$headingXs">
            {priceChange24hPercent}
          </PriceChangePercentage>
        </XStack>
      </XStack>

      <StatItem
        label={intl.formatMessage({ id: ETranslations.dexmarket_market_cap })}
        value={
          <NumberSizeableText
            size="$headingXs"
            color="$text"
            formatter="marketCap"
            formatterOptions={{
              capAtMaxT: true,
              currency: '$',
            }}
          >
            {marketCapValue}
          </NumberSizeableText>
        }
      />

      <StatItem
        label={intl.formatMessage({ id: ETranslations.dexmarket_liquidity })}
        value={
          <NumberSizeableText
            size="$headingXs"
            color="$text"
            formatter="marketCap"
            formatterOptions={{
              currency: '$',
            }}
          >
            {liquidityValue}
          </NumberSizeableText>
        }
      />

      <StatItem
        label={intl.formatMessage({ id: ETranslations.dexmarket_holders })}
        value={
          <NumberSizeableText
            size="$headingXs"
            color="$text"
            formatter="marketCap"
          >
            {holdersValue}
          </NumberSizeableText>
        }
      />

      {shareButton}
    </XStack>
  );
}
