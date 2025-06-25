import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import type { ColorTokens, IIconProps } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { TokenOverviewSkeleton } from './TokenOverviewSkeleton';

interface IStatItem {
  label: string;
  value: string;
  icon?: IIconProps['name'];
  iconColor?: ColorTokens;
}

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

function StatCard({ label, value, icon, iconColor }: IStatItem) {
  return (
    <Stack
      bg="$bgSubdued"
      borderRadius="$3"
      p="$3"
      flex={1}
      minHeight="$16"
      justifyContent="space-between"
      alignItems="center"
    >
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        mb="$2"
        textAlign="center"
      >
        {label}
      </SizableText>
      <XStack alignItems="center" gap="$1">
        {icon ? (
          <Icon name={icon} size="$4" color={iconColor || '$iconSuccess'} />
        ) : null}
        <SizableText size="$headingMd" color="$text" fontWeight="600">
          {value}
        </SizableText>
      </XStack>
    </Stack>
  );
}

export function TokenOverview() {
  const intl = useIntl();
  const { tokenDetail } = useTokenDetail();

  // Optimized stat builders
  const auditStat = useMemo<IStatItem>(
    () => ({
      label: intl.formatMessage({ id: ETranslations.dexmarket_audit }),
      value: intl.formatMessage(
        { id: ETranslations.dexmarket_details_audit_issue },
        { amount: 0 },
      ),
      icon: 'CheckLargeSolid',
      iconColor: '$iconSuccess',
    }),
    [intl],
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
    }),
    [intl, tokenDetail?.marketCap],
  );

  const liquidityStat = useMemo<IStatItem>(
    () => ({
      label: intl.formatMessage({ id: ETranslations.dexmarket_liquidity }),
      value: formatCurrencyValue(tokenDetail?.tvl),
    }),
    [intl, tokenDetail?.tvl],
  );

  const circulatingSupplyStat = useMemo<IStatItem>(
    () => ({
      label: intl.formatMessage({
        id: ETranslations.dexmarket_details_circulating_supply,
      }),
      value: tokenDetail ? formatCirculatingSupply(tokenDetail) : '--',
    }),
    [intl, tokenDetail],
  );

  const maxSupplyStat = useMemo<IStatItem>(
    () => ({
      label: intl.formatMessage({
        id: ETranslations.dexmarket_details_max_supply,
      }),
      value: formatTokenValue(tokenDetail?.liquidity as string | number),
    }),
    [intl, tokenDetail?.liquidity],
  );

  if (!tokenDetail) {
    return <TokenOverviewSkeleton />;
  }

  return (
    <Stack gap="$3" px="$5" py="$3">
      {/* Token Header with Avatar and Name */}
      <XStack alignItems="center" gap="$3" mb="$2">
        <Token size="lg" tokenImageUri={tokenDetail.logoUrl} />
        <Stack flex={1}>
          <SizableText size="$headingLg" color="$text" fontWeight="600">
            {tokenDetail.name}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {tokenDetail.symbol}
          </SizableText>
        </Stack>
      </XStack>

      {/* First row: Audit and Holders */}
      <XStack gap="$3">
        <StatCard {...auditStat} />
        <StatCard {...holdersStat} />
      </XStack>

      {/* Second row: Market cap and Liquidity */}
      <XStack gap="$3">
        <StatCard {...marketCapStat} />
        <StatCard {...liquidityStat} />
      </XStack>

      {/* Third row: Circulating supply and Maximum supply */}
      <XStack gap="$3">
        <StatCard {...circulatingSupplyStat} />
        <StatCard {...maxSupplyStat} />
      </XStack>
    </Stack>
  );
}
