import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IPortfolioSlice } from './DeFiPortfolioStats';

export function formatPortfolioPercent(percent: number): string {
  if (!Number.isFinite(percent)) return '0.0%';
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
    <YStack flex={1} gap="$2">
      {slices.map((slice) => {
        const label = slice.key === 'others' ? othersLabel : slice.label;
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
              {formatPortfolioPercent(slice.percent)}
            </SizableText>
          </XStack>
        );
      })}
    </YStack>
  );
}

DeFiPortfolioLegend.displayName = 'DeFiPortfolioLegend';

export { DeFiPortfolioLegend };
