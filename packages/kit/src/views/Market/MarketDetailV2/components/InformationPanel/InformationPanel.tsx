import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';

import { TokenTagsPopover } from '../../../components/TokenTagsPopover';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import {
  formatPriceChangeDisplay,
  formatRatioValue,
  formatStatValueWithFormatter,
} from '../../utils/statValue';
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

const usdCurrencyFormatter: INumberFormatProps = {
  formatter: 'marketCap',
  formatterOptions: {
    currency: '$',
  },
};

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack pointerEvents="none" gap="$1" width="100%" jc="space-between">
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodySmMedium">{value}</SizableText>
    </XStack>
  );
}

export function InformationPanel() {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { tokenDetail, networkId, tokenAddress, isStockToken } =
    useTokenDetail();

  const { securityData } = useTokenSecurity({
    tokenAddress,
    networkId,
  });

  if (!tokenDetail) return <InformationPanelSkeleton />;

  const {
    name = '',
    symbol = '',
    price: currentPrice = '--',
    priceChange24hPercent = '--',
    marketCap,
    liquidity,
    priceConverted,
    holders = 0,
    address = '',
    communityRecognized,
    stock,
  } = tokenDetail;

  const formattedMarketCap = formatStatValueWithFormatter(
    marketCap,
    usdCurrencyFormatter,
  );

  const formattedLiquidity = formatStatValueWithFormatter(
    liquidity,
    usdCurrencyFormatter,
  );

  const formattedHolders = formatStatValueWithFormatter(
    holders,
    marketCapFormatter,
  );

  const { color: priceChangeColor, display: priceChangeDisplay } =
    formatPriceChangeDisplay(priceChange24hPercent);

  return (
    <XStack
      px="$5"
      py="$4"
      gap="$4"
      jc="space-between"
      ai="flex-start"
      width="100%"
    >
      <YStack>
        <YStack pointerEvents="none">
          <MarketTokenPrice
            size={getPriceSizeByValue(currentPrice)}
            price={currentPrice}
            tokenName={name}
            tokenSymbol={symbol}
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
          <SizableText pt="$1" size="$bodyLgMedium" color={priceChangeColor}>
            {priceChangeDisplay}
          </SizableText>
        </YStack>
        <XStack ai="center" gap="$1" pt="$1">
          <TokenTagsPopover
            communityRecognized={communityRecognized}
            stock={stock}
            showAllInTrigger
            hideCommunityInTrigger
          />
        </XStack>
      </YStack>

      <YStack gap="$1" width="$40" pt="$1">
        {isStockToken && tokenDetail.stock ? (
          <>
            <StatRow
              label={intl.formatMessage({
                id: ETranslations.global_market_cap,
              })}
              value={formatStatValueWithFormatter(
                tokenDetail.stock.marketCap,
                usdCurrencyFormatter,
              )}
            />
            <StatRow
              label={intl.formatMessage({
                id: ETranslations.dexmarket_stock_24h_volume,
              })}
              value={formatStatValueWithFormatter(
                tokenDetail.stock.volume24h,
                usdCurrencyFormatter,
              )}
            />
            <StatRow
              label={intl.formatMessage({
                id: ETranslations.dexmarket_stock_pe_ttm,
              })}
              value={formatRatioValue(tokenDetail.stock.peRatio)}
            />
          </>
        ) : (
          <>
            <StatRow
              label={intl.formatMessage({
                id: ETranslations.global_market_cap,
              })}
              value={formattedMarketCap}
            />
            <StatRow
              label={intl.formatMessage({
                id: ETranslations.global_liquidity,
              })}
              value={formattedLiquidity}
            />
            <StatRow
              label={intl.formatMessage({
                id: ETranslations.dexmarket_holders,
              })}
              value={formattedHolders}
            />
          </>
        )}
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
