import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PORTFOLIO_OTHERS_KEY } from './DeFiPortfolioStats';
import { formatPortfolioPercent } from './formatPortfolioPercent';

import type { IPortfolioNetworkInfoMap } from './DeFiPortfolioCard';
import type { IPortfolioSlice } from './DeFiPortfolioStats';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

export type IDeFiPortfolioLegendProps = {
  slices: IPortfolioSlice[];
  networkInfoMap: IPortfolioNetworkInfoMap;
  // Single-chain mode: every slice's networkIds collapses to the same chain,
  // so rendering the badge is pure noise. Only show when the account is in
  // All Networks mode.
  showNetworkBadges?: boolean;
};

function DeFiPortfolioLegend({
  slices,
  networkInfoMap,
  showNetworkBadges,
}: IDeFiPortfolioLegendProps) {
  const intl = useIntl();
  const othersLabel = intl.formatMessage({ id: ETranslations.global_others });

  return (
    <YStack flex={1} gap="$2.5">
      {slices.map((slice) => {
        const isOthers = slice.key === PORTFOLIO_OTHERS_KEY;
        const label = isOthers ? othersLabel : slice.label;
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
              {showNetworkBadges && slice.networkIds.length > 0 ? (
                <XStack flexShrink={0}>
                  {slice.networkIds.map((networkId, index) => {
                    const info = networkInfoMap[networkId];
                    return (
                      <Stack
                        key={networkId}
                        {...(index !== 0 && { ml: '$-1.5' })}
                      >
                        <NetworkAvatarBase
                          size="$4"
                          logoURI={info?.logoURI ?? ''}
                          isAllNetworks={info?.isAllNetworks}
                          networkName={info?.name}
                        />
                      </Stack>
                    );
                  })}
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
