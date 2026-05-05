import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Skeleton, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { DeFiPortfolioDonut } from './DeFiPortfolioDonut';
import { DeFiPortfolioLegend } from './DeFiPortfolioLegend';
import { PORTFOLIO_TOP_N } from './DeFiPortfolioStats';
import { formatPortfolioTotal } from './formatPortfolioTotal';

import type { IPortfolioStats } from './DeFiPortfolioStats';

export type IDeFiPortfolioCardProps = {
  stats: IPortfolioStats;
  isLoading?: boolean;
  isAllNetworks?: boolean;
};

export type IPortfolioNetworkInfoMap = Record<string, IServerNetwork>;

const DONUT_SIZE = 140;
const DONUT_THICKNESS = 20;
const LEGEND_MIN_WIDTH = 220;
const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];
const EMPTY_NETWORK_INFO_MAP: IPortfolioNetworkInfoMap = {};

function DeFiPortfolioCard({
  stats,
  isLoading,
  isAllNetworks,
}: IDeFiPortfolioCardProps) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;
  const title = intl.formatMessage({ id: ETranslations.earn_portfolio_title });

  const formattedTotal = useMemo(
    () =>
      formatPortfolioTotal(
        stats.total,
        currencySymbol,
        settingsValue.hideValue,
      ),
    [stats.total, currencySymbol, settingsValue.hideValue],
  );

  // Resolve every chain icon in one bridge RPC instead of letting each
  // legend-row NetworkAvatar fire its own. For a portfolio with 6 slices
  // averaging ~2 chains each, this drops ~12 redundant RPCs to 1.
  const uniqueNetworkIds = useMemo(
    () => Array.from(new Set(stats.slices.flatMap((s) => s.networkIds))),
    [stats.slices],
  );
  const { result: networkInfoMap } = usePromiseResult<IPortfolioNetworkInfoMap>(
    async () => {
      if (uniqueNetworkIds.length === 0) return {};
      const { networks } =
        await backgroundApiProxy.serviceNetwork.getNetworksByIds({
          networkIds: uniqueNetworkIds,
        });
      return Object.fromEntries(networks.map((n) => [n.id, n]));
    },
    [uniqueNetworkIds],
    { initResult: EMPTY_NETWORK_INFO_MAP, checkIsFocused: false },
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
            {Array.from({ length: PORTFOLIO_TOP_N }).map((_, i) => (
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
          <DeFiPortfolioLegend
            slices={stats.slices}
            networkInfoMap={networkInfoMap ?? EMPTY_NETWORK_INFO_MAP}
            showNetworkBadges={Boolean(isAllNetworks)}
          />
        </YStack>
      </XStack>
    </XStack>
  );
}

DeFiPortfolioCard.displayName = 'DeFiPortfolioCard';

// Memoized: DeFiContainer's sticky-scroll state (pinnedKey, sticky line,
// sidebar metrics) updates every rAF while the user scrolls. Without memo
// the entire donut + legend tree re-renders on every scroll frame.
const MemoDeFiPortfolioCard = memo(DeFiPortfolioCard);
MemoDeFiPortfolioCard.displayName = 'DeFiPortfolioCard';

export { MemoDeFiPortfolioCard as DeFiPortfolioCard };
