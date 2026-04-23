import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { NetworkAvatarGroup } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PORTFOLIO_OTHERS_KEY } from './DeFiPortfolioStats';
import { formatPortfolioPercent } from './formatPortfolioPercent';

import type { IPortfolioSlice } from './DeFiPortfolioStats';

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
                flexShrink={0}
              />
              <SizableText
                flexShrink={1}
                minWidth={0}
                size="$bodyMd"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {label}
              </SizableText>
              {slice.networkIds.length > 0 ? (
                <NetworkAvatarGroup
                  networkIds={slice.networkIds}
                  size="$5"
                  flexShrink={0}
                />
              ) : null}
            </XStack>
            <SizableText
              size="$bodyMdMedium"
              color="$text"
              fontVariant={TABULAR_NUMS}
              flexShrink={0}
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
