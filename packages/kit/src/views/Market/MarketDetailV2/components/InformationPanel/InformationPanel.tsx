import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { useTokenDetail } from '../../hooks/useTokenDetail';
import { TokenSecurityAlert } from '../TokenSecurityAlert';
import { useTokenSecurity } from '../TokenSecurityAlert/hooks';

import { InformationPanelSkeleton } from './InformationPanelSkeleton';

export function InformationPanel() {
  const intl = useIntl();
  const { tokenDetail, networkId, tokenAddress } = useTokenDetail();

  // Directly use the security data hook to check if we have security data
  const { securityData } = useTokenSecurity({
    tokenAddress,
    networkId,
  });

  if (!tokenDetail) return <InformationPanelSkeleton />;

  const {
    name = '',
    symbol = '',
    price: currentPrice = '0',
    priceChange24hPercent = '0',
    marketCap = '0',
    volume24h = '0',
    holders = 0,
    address = '',
  } = tokenDetail;

  const priceChangeNum = parseFloat(priceChange24hPercent);
  const isPriceUp = priceChangeNum >= 0;

  return (
    <XStack px="$5" py="$4" gap="$4" jc="space-between" width="100%">
      <YStack pointerEvents="none">
        <MarketTokenPrice
          size="$heading3xl"
          price={currentPrice}
          tokenName={name}
          tokenSymbol={symbol}
        />
        <SizableText
          pt="$1"
          size="$bodyLgMedium"
          color={isPriceUp ? '$textSuccess' : '$textCritical'}
        >
          {isPriceUp ? '+' : ''}
          {priceChange24hPercent.slice(0, 6)}%
        </SizableText>
      </YStack>

      {/* Stats Row */}
      <YStack gap="$1" width="$40">
        <XStack pointerEvents="none" gap="$1" width="100%" jc="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_market_cap })}
          </SizableText>
          <SizableText size="$bodySmMedium">
            ${numberFormat(marketCap, { formatter: 'marketCap' })}
          </SizableText>
        </XStack>
        <XStack pointerEvents="none" gap="$1" width="100%" jc="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_liquidity })}
          </SizableText>
          <SizableText size="$bodySmMedium">
            ${numberFormat(volume24h, { formatter: 'marketCap' })}
          </SizableText>
        </XStack>
        <XStack pointerEvents="none" gap="$1" width="100%" jc="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.dexmarket_holders })}
          </SizableText>
          <SizableText size="$bodySmMedium">
            {numberFormat(String(holders), { formatter: 'marketCap' })}
          </SizableText>
        </XStack>
        {/* Audit / Security - Only show when we have security data */}
        {networkId && address && securityData ? (
          <XStack gap="$1" ai="center" width="100%" jc="space-between">
            <SizableText
              pointerEvents="none"
              size="$bodySm"
              color="$textSubdued"
            >
              {intl.formatMessage({ id: ETranslations.dexmarket_audit })}
            </SizableText>
            <TokenSecurityAlert />
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  );
}
