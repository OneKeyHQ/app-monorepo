import { useIntl } from 'react-intl';

import {
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DeFiPortfolioDonut } from './DeFiPortfolioDonut';
import { DeFiPortfolioLegend } from './DeFiPortfolioLegend';

import type { IPortfolioStats } from './DeFiPortfolioStats';

export type IDeFiPortfolioCardProps = {
  stats: IPortfolioStats;
  isLoading?: boolean;
};

const DONUT_SIZE = 120;
const LEGEND_MIN_WIDTH = 220;

function DeFiPortfolioCard({ stats, isLoading }: IDeFiPortfolioCardProps) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;
  const title = intl.formatMessage({ id: ETranslations.earn_portfolio_title });

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
          <YStack width={LEGEND_MIN_WIDTH} gap="$2">
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
      <YStack flex={1} gap="$1" minWidth={0}>
        <SizableText size="$headingLg" role="heading" aria-level={2}>
          {title}
        </SizableText>
        <NumberSizeableTextWrapper
          hideValue
          size="$heading3xl"
          formatter="value"
          formatterOptions={{ currency: currencySymbol }}
        >
          {stats.total}
        </NumberSizeableTextWrapper>
      </YStack>
      <XStack gap="$4" alignItems="center" flexShrink={0}>
        <Stack flexShrink={0}>
          <DeFiPortfolioDonut slices={stats.slices} size={DONUT_SIZE} />
        </Stack>
        <YStack width={LEGEND_MIN_WIDTH}>
          <DeFiPortfolioLegend slices={stats.slices} />
        </YStack>
      </XStack>
    </XStack>
  );
}

DeFiPortfolioCard.displayName = 'DeFiPortfolioCard';

export { DeFiPortfolioCard };
