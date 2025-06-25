import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';
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
  icon?: string;
  iconColor?: ColorTokens;
}

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
          <Icon
            name={icon as any}
            size="$4"
            color={iconColor || '$iconSuccess'}
          />
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

  const stats = useMemo<IStatItem[]>(() => {
    if (!tokenDetail) {
      return [];
    }

    return [
      {
        label: intl.formatMessage({ id: ETranslations.dexmarket_audit }),
        value: intl.formatMessage(
          {
            id: ETranslations.dexmarket_details_audit_issue,
          },
          { amount: 0 },
        ),
        icon: 'BadgeCheckSolid',
        iconColor: '$iconSuccess' as ColorTokens,
      },
      {
        label: intl.formatMessage({ id: ETranslations.dexmarket_holders }),
        value: tokenDetail.holders
          ? String(
              formatDisplayNumber(
                NUMBER_FORMATTER.marketCap(String(tokenDetail.holders)),
              ),
            )
          : '--',
      },
      {
        label: intl.formatMessage({ id: ETranslations.dexmarket_market_cap }),
        value: tokenDetail.marketCap
          ? `$${String(
              formatDisplayNumber(
                NUMBER_FORMATTER.marketCap(String(tokenDetail.marketCap)),
              ),
            )}`
          : '--',
      },
      {
        label: intl.formatMessage({ id: ETranslations.dexmarket_liquidity }),
        value: tokenDetail.tvl
          ? `$${String(
              formatDisplayNumber(
                NUMBER_FORMATTER.marketCap(String(tokenDetail.tvl)),
              ),
            )}`
          : '--',
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_details_circulating_supply,
        }),
        value: (() => {
          if (tokenDetail.fdv) {
            return String(
              formatDisplayNumber(
                NUMBER_FORMATTER.marketCap(String(tokenDetail.fdv)),
              ),
            );
          }
          if (tokenDetail.marketCap) {
            return String(
              formatDisplayNumber(
                NUMBER_FORMATTER.marketCap(String(tokenDetail.marketCap)),
              ),
            );
          }
          return '--';
        })(),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_details_max_supply,
        }),
        value: tokenDetail.fdv
          ? String(
              formatDisplayNumber(
                NUMBER_FORMATTER.marketCap(String(tokenDetail.fdv)),
              ),
            )
          : '--',
      },
    ];
  }, [tokenDetail, intl]);

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
        <StatCard {...stats[0]} />
        <StatCard {...stats[1]} />
      </XStack>

      {/* Second row: Market cap and Liquidity */}
      <XStack gap="$3">
        <StatCard {...stats[2]} />
        <StatCard {...stats[3]} />
      </XStack>

      {/* Third row: Circulating supply and Maximum supply */}
      <XStack gap="$3">
        <StatCard {...stats[4]} />
        <StatCard {...stats[5]} />
      </XStack>
    </Stack>
  );
}
