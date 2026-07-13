import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, SizableText, Stack, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { openBlockExplorerUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { MarketTestIDs } from '../../../testIDs';
import { useBtcMetadataContext } from '../../hooks/BtcMetadataContext';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import {
  MARKET_CAP_FORMATTER,
  USD_CURRENCY_FORMATTER,
  formatBlockHeightValue,
  formatCurrencyStatValue,
  formatMarketCapValue,
  formatStatValueWithFormatter,
} from '../../utils/statValue';
import { TokenSecurityAlertDialogContent } from '../TokenSecurityAlert/components';
import { useTokenSecurity } from '../TokenSecurityAlert/hooks/useTokenSecurity';
import { getTotalSecurityDisplayInfo } from '../TokenSecurityAlert/utils/utils';

import { StatCard } from './components/StatCard';
import { TokenOverviewSkeleton } from './TokenOverviewSkeleton';

import type { IStatItem } from './components/StatCard';

export function TokenOverview() {
  const intl = useIntl();
  const { tokenDetail, tokenAddress, networkId } = useTokenDetail();
  const { securityStatus, securityData, riskCount, cautionCount } =
    useTokenSecurity({
      tokenAddress,
      networkId,
    });
  const btcMetadata = useBtcMetadataContext();

  const handleAuditPress = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.dexmarket_audit }),
      showFooter: false,
      renderContent: (
        <TokenSecurityAlertDialogContent
          securityData={securityData}
          riskCount={riskCount}
          cautionCount={cautionCount}
        />
      ),
    });
    if (networkId && tokenAddress && tokenDetail) {
      defaultLogger.dex.actions.dexCheckRisk({
        network: networkId,
        tokenSymbol: tokenDetail.symbol || '',
        tokenContract: tokenAddress,
      });
    }
  }, [
    intl,
    securityData,
    riskCount,
    cautionCount,
    networkId,
    tokenAddress,
    tokenDetail,
  ]);

  const auditStat = useMemo<IStatItem>(() => {
    const { count, color } = getTotalSecurityDisplayInfo(
      securityStatus,
      riskCount,
      cautionCount,
    );

    return {
      label: intl.formatMessage({ id: ETranslations.dexmarket_audit }),
      value: intl.formatMessage(
        { id: ETranslations.dexmarket_details_audit_issue },
        { amount: count },
      ),
      icon: 'BugOutline',
      iconColor: color,
      onPress: securityData ? handleAuditPress : undefined,
    };
  }, [
    intl,
    riskCount,
    cautionCount,
    securityStatus,
    handleAuditPress,
    securityData,
  ]);

  const handleBlockHeightPress = useCallback(() => {
    if (!btcMetadata) {
      return;
    }
    void openBlockExplorerUrl({
      networkId,
      blockHeight: btcMetadata.blockHeight,
    });
  }, [btcMetadata, networkId]);

  if (!tokenDetail) {
    return <TokenOverviewSkeleton />;
  }

  return (
    <Stack testID={MarketTestIDs.detailAbout} gap="$2" px="$5" pt="$5" pb="$3">
      <XStack alignItems="center" gap="$3" mb="$3">
        <Token size="lg" tokenImageUri={tokenDetail.logoUrl} />
        <Stack flex={1}>
          <SizableText size="$headingLg" color="$text" fontWeight="600">
            {tokenDetail.symbol}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {tokenDetail.name}
          </SizableText>
        </Stack>
      </XStack>

      {btcMetadata ? (
        <>
          <XStack gap="$2">
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_market_cap,
              })}
              value={formatCurrencyStatValue(btcMetadata.marketCap)}
            />
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_stock_24h_volume,
              })}
              value={formatCurrencyStatValue(btcMetadata.volume24h)}
            />
          </XStack>
          <XStack gap="$2">
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_btc_circulating_supply,
              })}
              value={formatMarketCapValue(btcMetadata.circulatingSupply)}
            />
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_btc_remaining_supply,
              })}
              value={formatMarketCapValue(btcMetadata.remainingSupply)}
            />
          </XStack>
          <XStack gap="$2">
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_btc_total_supply,
              })}
              value={formatMarketCapValue(btcMetadata.totalSupply)}
            />
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_btc_block_height,
              })}
              value={formatBlockHeightValue(btcMetadata.blockHeight)}
              onPress={handleBlockHeightPress}
            />
          </XStack>
          <XStack gap="$2">
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_btc_block_reward,
              })}
              value={`${btcMetadata.blockReward} BTC`}
            />
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_btc_next_halving,
              })}
              value={btcMetadata.nextHalvingDisplay}
            />
          </XStack>
        </>
      ) : (
        <>
          <XStack gap="$2">
            <StatCard {...auditStat} />
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_holders,
              })}
              value={formatStatValueWithFormatter(
                tokenDetail.holders,
                MARKET_CAP_FORMATTER,
              )}
            />
          </XStack>

          <XStack gap="$2">
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_market_cap,
              })}
              value={formatStatValueWithFormatter(
                tokenDetail.marketCap,
                USD_CURRENCY_FORMATTER,
              )}
              tooltip={intl.formatMessage({
                id: ETranslations.dexmarket_mc_tips,
              })}
            />
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_liquidity,
              })}
              value={formatStatValueWithFormatter(
                tokenDetail.tvl,
                USD_CURRENCY_FORMATTER,
              )}
              tooltip={intl.formatMessage({
                id: ETranslations.dexmarket_Liq_tips,
              })}
            />
          </XStack>

          <XStack gap="$2">
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_details_circulating_supply,
              })}
              value={formatStatValueWithFormatter(
                tokenDetail.circulatingSupply,
                MARKET_CAP_FORMATTER,
              )}
              tooltip={intl.formatMessage({
                id: ETranslations.dexmarket_circulating_supply_tips,
              })}
            />
            <StatCard
              label={intl.formatMessage({
                id: ETranslations.dexmarket_fdv_title,
              })}
              value={formatStatValueWithFormatter(
                tokenDetail.fdv,
                USD_CURRENCY_FORMATTER,
              )}
              tooltip={intl.formatMessage({
                id: ETranslations.dexmarket_fdv_desc,
              })}
            />
          </XStack>
        </>
      )}
    </Stack>
  );
}
