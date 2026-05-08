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
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { TokenTagsPopover } from '../../../components/TokenTagsPopover';
import { useBtcMetadataContext } from '../../hooks/BtcMetadataContext';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import {
  MARKET_CAP_FORMATTER,
  USD_CURRENCY_FORMATTER,
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

function HeaderStatRows({
  isStockToken,
  stock,
  btcMetadata,
  fallback,
}: {
  isStockToken: boolean;
  stock: IMarketTokenDetail['stock'];
  btcMetadata: ReturnType<typeof useBtcMetadataContext>;
  fallback: {
    marketCap: string;
    liquidity: string;
    holders: string;
  };
}) {
  const intl = useIntl();
  if (isStockToken && stock) {
    return (
      <>
        <StatRow
          label={intl.formatMessage({ id: ETranslations.global_market_cap })}
          value={formatStatValueWithFormatter(
            stock.marketCap,
            USD_CURRENCY_FORMATTER,
          )}
        />
        <StatRow
          label={intl.formatMessage({
            id: ETranslations.dexmarket_stock_24h_volume,
          })}
          value={formatStatValueWithFormatter(
            stock.assetAnalysis?.volume24h,
            USD_CURRENCY_FORMATTER,
          )}
        />
        <StatRow
          label={intl.formatMessage({
            id: ETranslations.dexmarket_stock_pe_ttm,
          })}
          value={formatRatioValue(stock.tradingActivity?.peRatio)}
        />
      </>
    );
  }
  if (btcMetadata) {
    return (
      <>
        <StatRow
          label={intl.formatMessage({ id: ETranslations.global_market_cap })}
          value={formatStatValueWithFormatter(
            btcMetadata.marketCap,
            USD_CURRENCY_FORMATTER,
          )}
        />
        <StatRow
          label={intl.formatMessage({
            id: ETranslations.dexmarket_stock_24h_volume,
          })}
          value={formatStatValueWithFormatter(
            btcMetadata.volume24h,
            USD_CURRENCY_FORMATTER,
          )}
        />
        <StatRow
          label={intl.formatMessage({
            id: ETranslations.dexmarket_btc_circulating_supply,
          })}
          value={formatStatValueWithFormatter(
            btcMetadata.circulatingSupply,
            MARKET_CAP_FORMATTER,
          )}
        />
      </>
    );
  }
  return (
    <>
      <StatRow
        label={intl.formatMessage({ id: ETranslations.global_market_cap })}
        value={fallback.marketCap}
      />
      <StatRow
        label={intl.formatMessage({ id: ETranslations.global_liquidity })}
        value={fallback.liquidity}
      />
      <StatRow
        label={intl.formatMessage({ id: ETranslations.dexmarket_holders })}
        value={fallback.holders}
      />
    </>
  );
}

export function InformationPanel() {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { tokenDetail, networkId, tokenAddress, isStockToken } =
    useTokenDetail();
  const btcMetadata = useBtcMetadataContext();

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
    USD_CURRENCY_FORMATTER,
  );

  const formattedLiquidity = formatStatValueWithFormatter(
    liquidity,
    USD_CURRENCY_FORMATTER,
  );

  const formattedHolders = formatStatValueWithFormatter(
    holders,
    MARKET_CAP_FORMATTER,
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
            noTruncateSubtitle={isStockToken}
          />
        </XStack>
      </YStack>

      <YStack gap="$1" width="$40" pt="$1">
        <HeaderStatRows
          isStockToken={Boolean(isStockToken)}
          stock={stock}
          btcMetadata={btcMetadata}
          fallback={{
            marketCap: formattedMarketCap,
            liquidity: formattedLiquidity,
            holders: formattedHolders,
          }}
        />
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
