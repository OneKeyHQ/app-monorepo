import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText, Skeleton, XStack, YStack } from '@onekeyhq/components';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DeFiPortfolioDonut } from './DeFiPortfolioDonut';
import { DeFiPortfolioLegend } from './DeFiPortfolioLegend';

import type { IPortfolioStats } from './DeFiPortfolioStats';

export type IDeFiPortfolioCardProps = {
  stats: IPortfolioStats;
  isLoading?: boolean;
};

const DONUT_SIZE = 140;
const DONUT_THICKNESS = 20;
const LEGEND_MIN_WIDTH = 220;
const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];
// Net worth above this reads as "substantial"; cents are noise at that scale.
// Below it, two decimals stay informative.
const PORTFOLIO_DECIMAL_THRESHOLD = 10;

function formatPortfolioTotal(
  total: number,
  currency: string,
  hide: boolean,
): string {
  if (hide) return `${currency}****`;
  if (!Number.isFinite(total) || total < 0) return `${currency}0.00`;
  const bn = new BigNumber(total);
  if (bn.lt(PORTFOLIO_DECIMAL_THRESHOLD)) {
    return `${currency}${bn.toFormat(2)}`;
  }
  return `${currency}${new BigNumber(Math.round(total)).toFormat()}`;
}

function DeFiPortfolioCard({ stats, isLoading }: IDeFiPortfolioCardProps) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;
  const title = intl.formatMessage({ id: ETranslations.earn_portfolio_title });

  const formattedTotal = useMemo(
    () => formatPortfolioTotal(stats.total, currencySymbol, settingsValue.hideValue),
    [stats.total, currencySymbol, settingsValue.hideValue],
  );

  if (isLoading) {
    return (
      <XStack gap="$6" alignItems="flex-start" justifyContent="space-between">
        <YStack flex={1} gap="$2" minWidth={0}>
          <Skeleton width={140} height={16} borderRadius="$1" />
          <Skeleton width={220} height={32} borderRadius="$1" />
        </YStack>
        <XStack gap="$4" alignItems="center" flexShrink={0}>
          <Skeleton
            width={DONUT_SIZE}
            height={DONUT_SIZE}
            borderRadius="$full"
          />
          <YStack width={LEGEND_MIN_WIDTH} gap="$2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                // eslint-disable-next-line react/no-array-index-key
                key={`portfolio-legend-skeleton-${i}`}
                width="100%"
                height={14}
                borderRadius="$1"
              />
            ))}
          </YStack>
        </XStack>
      </XStack>
    );
  }

  return (
    <XStack
      gap="$6"
      alignItems="flex-start"
      justifyContent="space-between"
      userSelect="none"
    >
      <YStack flex={1} gap="$2" minWidth={0}>
        <SizableText size="$headingLg" role="heading" aria-level={2}>
          {title}
        </SizableText>
        <SizableText size="$heading3xl" fontVariant={TABULAR_NUMS}>
          {formattedTotal}
        </SizableText>
      </YStack>
      <XStack gap="$4" alignItems="center" flexShrink={0}>
        <DeFiPortfolioDonut
          slices={stats.slices}
          size={DONUT_SIZE}
          thickness={DONUT_THICKNESS}
        />
        <YStack width={LEGEND_MIN_WIDTH}>
          <DeFiPortfolioLegend slices={stats.slices} />
        </YStack>
      </XStack>
    </XStack>
  );
}

DeFiPortfolioCard.displayName = 'DeFiPortfolioCard';

export { DeFiPortfolioCard };
