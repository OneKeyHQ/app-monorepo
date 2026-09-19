import { useCallback } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  InteractiveIcon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { openExplorerAddressUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { useToMarketStockDetailPage } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { SwapTestIDs } from '../../testIDs';

// cspell:words xstock xStocks
const STOCK_ISSUER_NAMES: Record<string, string> = {
  coingecko: 'Ondo',
  ondo: 'Ondo',
  xstock: 'xStocks',
};

function getStockIssuerName(source?: string) {
  const normalizedSource = source?.trim().toLowerCase();
  if (!normalizedSource) {
    return '--';
  }
  return STOCK_ISSUER_NAMES[normalizedSource] ?? source ?? '--';
}

function TokenDetailRow({
  label,
  labelAction,
  children,
}: {
  label: string;
  labelAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <XStack
      h={44}
      px="$3"
      py="$3"
      borderRadius="$3"
      bg="$bgSubdued"
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
    >
      <XStack alignItems="center" gap="$1" flexShrink={1}>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {label}
        </SizableText>
        {labelAction}
      </XStack>
      {children}
    </XStack>
  );
}

function ContractAddressValue({
  address,
  networkId,
}: {
  address: string;
  networkId?: string;
}) {
  const { copyText } = useClipboard();
  const handleCopy = useCallback(() => {
    copyText(address);
  }, [address, copyText]);
  const handleOpen = useCallback(() => {
    void openExplorerAddressUrl({
      networkId,
      address,
      openInExternal: true,
    });
  }, [address, networkId]);

  return (
    <XStack alignItems="center" gap="$1.5" minWidth={0}>
      <SizableText
        size="$bodyMdMedium"
        color="$text"
        numberOfLines={1}
        flexShrink={1}
      >
        {accountUtils.shortenAddress({
          address,
          leadingLength: 6,
          trailingLength: 6,
        })}
      </SizableText>
      <InteractiveIcon
        testID={SwapTestIDs.stockTokenContractCopy}
        icon="Copy3Outline"
        size="$4"
        onPress={handleCopy}
      />
      <InteractiveIcon
        testID={SwapTestIDs.stockTokenContractOpen}
        icon="OpenOutline"
        size="$4"
        onPress={handleOpen}
      />
    </XStack>
  );
}

export function SwapStockTokenDetails({
  loading,
  networkId,
  tokenDetail,
}: {
  loading?: boolean;
  networkId?: string;
  tokenDetail?: IMarketTokenDetail;
}) {
  const intl = useIntl();
  const stock = tokenDetail?.stock;
  const tokenAddress = tokenDetail?.address;
  const issuerName = getStockIssuerName(stock?.source);
  const issuerWebsite = tokenDetail?.extraData?.website;
  const toMarketStockDetailPage = useToMarketStockDetailPage();
  const handleOpenIssuerWebsite = useCallback(() => {
    if (issuerWebsite) {
      openUrlExternal(issuerWebsite);
    }
  }, [issuerWebsite]);
  const handleOpenMarketDetails = useCallback(() => {
    if (stock?.stockId) {
      void toMarketStockDetailPage(stock.stockId);
    }
  }, [stock?.stockId, toMarketStockDetailPage]);

  if (!loading && (!stock || !tokenAddress)) {
    return null;
  }

  return (
    <YStack mt="$6" gap="$2.5" testID={SwapTestIDs.stockTokenDetails}>
      <SizableText size="$bodyMdMedium" color="$text">
        {intl.formatMessage({ id: ETranslations.trade_stocks_token_details })}
      </SizableText>
      <YStack
        gap="$2"
        testID={loading ? SwapTestIDs.stockTokenDetailsLoading : undefined}
      >
        <TokenDetailRow
          label={intl.formatMessage({
            id: ETranslations.trade_stocks_token_issuer,
          })}
        >
          {loading ? (
            <Skeleton h="$5" w="$16" />
          ) : (
            <XStack alignItems="center" gap="$1.5">
              <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
                {issuerName}
              </SizableText>
              {issuerWebsite ? (
                <InteractiveIcon
                  testID={SwapTestIDs.stockTokenIssuerOpen}
                  icon="OpenOutline"
                  size="$4"
                  onPress={handleOpenIssuerWebsite}
                />
              ) : null}
            </XStack>
          )}
        </TokenDetailRow>
        <TokenDetailRow
          label={intl.formatMessage({
            id: ETranslations.trade_stocks_contract_address,
          })}
        >
          {loading || !tokenAddress ? (
            <Skeleton h="$5" w="$32" />
          ) : (
            <ContractAddressValue
              address={tokenAddress}
              networkId={networkId}
            />
          )}
        </TokenDetailRow>
        {stock?.stockId ? (
          <XStack
            testID="stock-token-details-market-link"
            alignItems="center"
            justifyContent="center"
            gap="$1"
            py="$2"
            cursor="pointer"
            onPress={handleOpenMarketDetails}
          >
            <SizableText size="$bodyMdMedium" color="$textInteractive">
              {intl.formatMessage({
                id: ETranslations.market_view_stock_token_details,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium" color="$textInteractive">
              ↗
            </SizableText>
          </XStack>
        ) : null}
      </YStack>
    </YStack>
  );
}
