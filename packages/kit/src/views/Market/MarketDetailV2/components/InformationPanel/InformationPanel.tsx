import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { useTokenDetail } from '../../hooks/useTokenDetail';
import { TokenSecurityAlert } from '../TokenSecurityAlert';
import { useTokenSecurity } from '../TokenSecurityAlert/hooks';

import { InformationPanelSkeleton } from './InformationPanelSkeleton';

function getPriceSizeByValue(price: string) {
  if (price.startsWith('0.0000')) {
    return '$headingLg';
  }
  if (price.startsWith('0.000')) {
    return '$headingXl';
  }
  return '$heading3xl';
}

const marketCapFormatter: INumberFormatProps = {
  formatter: 'marketCap',
};

export function InformationPanel() {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const { tokenDetail, networkId, tokenAddress } = useTokenDetail();

  // Directly use the security data hook to check if we have security data
  const { securityData } = useTokenSecurity({
    tokenAddress,
    networkId,
  });

  const currencyFormatter: INumberFormatProps = useMemo(() => {
    const currencySymbol = settings.currencyInfo.symbol;
    return {
      formatter: 'marketCap',
      formatterOptions: {
        currency: currencySymbol,
      },
    };
  }, [settings.currencyInfo.symbol]);

  if (!tokenDetail) return <InformationPanelSkeleton />;

  const {
    name = '',
    symbol = '',
    price: currentPrice = '0',
    priceChange24hPercent = '0',
    marketCap = '0',
    liquidity = '0',
    holders = 0,
    address = '',
  } = tokenDetail;

  const formattedMarketCap = numberFormat(marketCap, currencyFormatter);

  const formattedLiquidity = numberFormat(liquidity, currencyFormatter);

  const priceChangeNum = parseFloat(priceChange24hPercent);
  const isPriceUp = priceChangeNum >= 0;

  return (
    <XStack px="$5" py="$4" gap="$4" jc="space-between" width="100%">
      <YStack pointerEvents="none">
        <MarketTokenPrice
          size={getPriceSizeByValue(currentPrice)}
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
          <SizableText size="$bodySmMedium">{formattedMarketCap}</SizableText>
        </XStack>
        <XStack pointerEvents="none" gap="$1" width="100%" jc="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_liquidity })}
          </SizableText>
          <SizableText size="$bodySmMedium">{formattedLiquidity}</SizableText>
        </XStack>
        <XStack pointerEvents="none" gap="$1" width="100%" jc="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.dexmarket_holders })}
          </SizableText>
          <SizableText size="$bodySmMedium">
            {numberFormat(String(holders), marketCapFormatter)}
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
