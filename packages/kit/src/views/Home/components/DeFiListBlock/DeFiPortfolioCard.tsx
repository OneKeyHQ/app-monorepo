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

const CARD_WIDTH = 320;
const DONUT_SIZE = 120;

function DeFiPortfolioCard({ stats, isLoading }: IDeFiPortfolioCardProps) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;
  const title = intl.formatMessage({ id: ETranslations.earn_portfolio_title });

  if (isLoading) {
    return (
      <YStack
        width={CARD_WIDTH}
        flexShrink={0}
        bg="$bgSubdued"
        borderRadius="$3"
        p="$5"
        gap="$4"
      >
        <Skeleton width={120} height={16} borderRadius="$1" />
        <Skeleton width={180} height={28} borderRadius="$1" />
        <XStack gap="$4" alignItems="center">
          <Skeleton
            width={DONUT_SIZE}
            height={DONUT_SIZE}
            borderRadius="$full"
          />
          <YStack flex={1} gap="$2">
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
      </YStack>
    );
  }

  return (
    <YStack
      width={CARD_WIDTH}
      flexShrink={0}
      bg="$bgSubdued"
      borderRadius="$3"
      p="$5"
      gap="$4"
      userSelect="none"
    >
      <YStack gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
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
      <XStack gap="$4" alignItems="center">
        <Stack flexShrink={0}>
          <DeFiPortfolioDonut slices={stats.slices} size={DONUT_SIZE} />
        </Stack>
        <DeFiPortfolioLegend slices={stats.slices} />
      </XStack>
    </YStack>
  );
}

DeFiPortfolioCard.displayName = 'DeFiPortfolioCard';

export { DeFiPortfolioCard };
