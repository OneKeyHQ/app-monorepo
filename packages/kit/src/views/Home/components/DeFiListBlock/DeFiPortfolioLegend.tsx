import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PORTFOLIO_OTHERS_KEY } from './DeFiPortfolioStats';

import type { IPortfolioSlice } from './DeFiPortfolioStats';

/**
 * `percent` is the rounded-to-1-decimal display value. When it rounds down to
 * `0.0` but the underlying position is still non-zero, show `<0.1%` so tiny
 * slices don't read as missing data.
 */
export function formatPortfolioPercent(
  percent: number,
  netWorth?: number | string,
): string {
  if (!Number.isFinite(percent)) return '0.0%';
  if (percent === 0 && netWorth !== undefined && Number(netWorth) > 0) {
    return '<0.1%';
  }
  return `${percent.toFixed(1)}%`;
}

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

export type IDeFiPortfolioLegendProps = {
  slices: IPortfolioSlice[];
};

function DeFiPortfolioLegend({ slices }: IDeFiPortfolioLegendProps) {
  const intl = useIntl();
  const othersLabel = intl.formatMessage({ id: ETranslations.global_others });

  return (
    <YStack flex={1} gap="$2.5">
      {slices.map((slice) => {
        const label =
          slice.key === PORTFOLIO_OTHERS_KEY ? othersLabel : slice.label;
        return (
          <XStack
            key={slice.key}
            alignItems="center"
            justifyContent="space-between"
            gap="$2"
          >
            <XStack flex={1} minWidth={0} alignItems="center" gap="$2">
              <Stack
                width={8}
                height={8}
                borderRadius="$full"
                bg={slice.colorToken}
              />
              <SizableText
                flex={1}
                minWidth={0}
                size="$bodyMd"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {label}
              </SizableText>
            </XStack>
            <SizableText
              size="$bodyMdMedium"
              color="$text"
              fontVariant={TABULAR_NUMS}
            >
              {formatPortfolioPercent(slice.percent, slice.netWorth)}
            </SizableText>
          </XStack>
        );
      })}
    </YStack>
  );
}

DeFiPortfolioLegend.displayName = 'DeFiPortfolioLegend';

export { DeFiPortfolioLegend };
