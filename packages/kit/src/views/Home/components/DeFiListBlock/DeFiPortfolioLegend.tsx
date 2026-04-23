import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
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
        const isOthers = slice.key === PORTFOLIO_OTHERS_KEY;
        return (
          <XStack
            key={slice.key}
            alignItems="center"
            justifyContent="space-between"
            gap="$2"
            minHeight={24}
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
                color={isOthers ? '$textSubdued' : '$text'}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {label}
              </SizableText>
              {slice.networkIds.length > 0 ? (
                <XStack flexShrink={0}>
                  {slice.networkIds.map((networkId, index) => (
                    <Stack
                      key={networkId}
                      p="$0.5"
                      borderRadius="$full"
                      bg="$bgApp"
                      {...(index !== 0 && { ml: '$-1.5' })}
                    >
                      <NetworkAvatar networkId={networkId} size="$4" />
                    </Stack>
                  ))}
                </XStack>
              ) : null}
            </XStack>
            <SizableText
              size="$bodyMdMedium"
              color={isOthers ? '$textSubdued' : '$text'}
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
