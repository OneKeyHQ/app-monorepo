import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, SizableText, Stack, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { useTokenDetail } from '../../hooks/useTokenDetail';
import { TokenSecurityAlertDialogContent } from '../TokenSecurityAlert/components';
import { useTokenSecurity } from '../TokenSecurityAlert/hooks/useTokenSecurity';

import { StatCard } from './components/StatCard';
import { TokenOverviewSkeleton } from './TokenOverviewSkeleton';

import type { IStatItem } from './components/StatCard';

// Helper functions for value formatting
const formatTokenValue = (value: string | number | undefined): string => {
  if (!value) return '--';
  return String(formatDisplayNumber(NUMBER_FORMATTER.marketCap(String(value))));
};

const formatCurrencyValue = (value: string | number | undefined): string => {
  if (!value) return '--';
  return `$${formatTokenValue(value)}`;
};

interface ITokenDetail {
  fdv?: string | number;
  marketCap?: string | number;
  holders?: string | number;
  tvl?: string | number;
  liquidity?: string | number;
  logoUrl?: string;
  name?: string;
  symbol?: string;
}

const formatCirculatingSupply = (tokenDetail: ITokenDetail): string => {
  if (tokenDetail.fdv) {
    return formatTokenValue(tokenDetail.fdv);
  }
  if (tokenDetail.marketCap) {
    return formatTokenValue(tokenDetail.marketCap);
  }
  return '--';
};

export function TokenOverview() {
  const intl = useIntl();
  const { tokenDetail, tokenAddress, networkId } = useTokenDetail();
  const { warningCount, securityStatus, securityData } = useTokenSecurity({
    tokenAddress,
    networkId,
  });

  const handleAuditPress = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.dexmarket_audit }),
      showFooter: false,
      renderContent: (
        <TokenSecurityAlertDialogContent
          securityData={securityData}
          warningCount={warningCount}
        />
      ),
    });
  }, [intl, securityData, warningCount]);

  // Optimized stat builders
  const auditStat = useMemo<IStatItem>(
    () => ({
      label: intl.formatMessage({ id: ETranslations.dexmarket_audit }),
      value: intl.formatMessage(
        { id: ETranslations.dexmarket_details_audit_issue },
        { amount: warningCount },
      ),
      icon: securityStatus === 'safe' ? 'ShieldCheckDoneSolid' : 'BugOutline',
      iconColor: securityStatus === 'safe' ? '$iconSuccess' : '$iconCaution',
      onPress: securityData ? handleAuditPress : undefined,
    }),
    [intl, warningCount, securityStatus, handleAuditPress, securityData],
  );

  const holdersStat = useMemo<IStatItem>(
    () => ({
      label: intl.formatMessage({ id: ETranslations.dexmarket_holders }),
      value: formatTokenValue(tokenDetail?.holders),
    }),
    [intl, tokenDetail?.holders],
  );

  const marketCapStat = useMemo<IStatItem>(
    () => ({
      label: intl.formatMessage({ id: ETranslations.dexmarket_market_cap }),
      value: formatCurrencyValue(tokenDetail?.marketCap),
      tooltip: intl.formatMessage({ id: ETranslations.dexmarket_mc_tips }),
    }),
    [intl, tokenDetail?.marketCap],
  );

  const liquidityStat = useMemo<IStatItem>(
    () => ({
      label: intl.formatMessage({ id: ETranslations.dexmarket_liquidity }),
      value: formatCurrencyValue(tokenDetail?.tvl),
      tooltip: intl.formatMessage({ id: ETranslations.dexmarket_Liq_tips }),
    }),
    [intl, tokenDetail?.tvl],
  );

  const circulatingSupplyStat = useMemo<IStatItem>(
    () => ({
      label: intl.formatMessage({
        id: ETranslations.dexmarket_details_circulating_supply,
      }),
      value: tokenDetail ? formatCirculatingSupply(tokenDetail) : '--',
      tooltip: intl.formatMessage({
        id: ETranslations.dexmarket_circulating_supply_tips,
      }),
    }),
    [intl, tokenDetail],
  );

  const fdvStat = useMemo<IStatItem>(
    () => ({
      label: intl.formatMessage({ id: ETranslations.dexmarket_fdv_title }),
      value: formatCurrencyValue(tokenDetail?.fdv),
      tooltip: intl.formatMessage({
        id: ETranslations.dexmarket_fdv_desc,
      }),
    }),
    [intl, tokenDetail?.fdv],
  );

  if (!tokenDetail) {
    return <TokenOverviewSkeleton />;
  }

  return (
    <Stack gap="$2" px="$5" pt="$5" pb="$3">
      {/* Token Header with Avatar and Name */}
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

      {/* First row: Audit and Holders */}
      <XStack gap="$2">
        <StatCard {...auditStat} />
        <StatCard {...holdersStat} />
      </XStack>

      {/* Second row: Market cap and Liquidity */}
      <XStack gap="$2">
        <StatCard {...marketCapStat} />
        <StatCard {...liquidityStat} />
      </XStack>

      {/* Third row: Circulating supply and FDV */}
      <XStack gap="$2">
        <StatCard {...circulatingSupplyStat} />
        <StatCard {...fdvStat} />
      </XStack>
    </Stack>
  );
}
