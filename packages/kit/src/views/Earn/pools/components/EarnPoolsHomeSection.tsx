import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPoolListItem } from '@onekeyhq/shared/types/pools';

import { EARN_LIST_ROW_GAP } from '../../components/earnListRhythm';
import { sortPools } from '../poolsFilter';
import { PoolsNavigation } from '../poolsNavigation';
import { PoolsQueries, usePoolsQuery } from '../poolsQueries';

import { PoolListRow } from './PoolsDiscoverList';

const MAX_HOME_POOLS = 4;

/**
 * Highest-TVL pools, one per pair, so four ETH/USDC fee tiers do not fill
 * the section; the pool page compares the rest of a pair (proposal).
 */
function pickHomePools(pools: IPoolListItem[]) {
  const seenPairs = new Set<string>();
  const picked: IPoolListItem[] = [];
  for (const pool of sortPools(pools, 'tvl', 'desc', '1D')) {
    if (!seenPairs.has(pool.pairKey)) {
      seenPairs.add(pool.pairKey);
      picked.push(pool);
    }
    if (picked.length === MAX_HOME_POOLS) {
      break;
    }
  }
  return picked;
}

function EarnPoolsHomeSectionSkeleton() {
  return (
    <YStack px="$pagePadding" gap="$3">
      <Skeleton width={120} height={28} borderRadius="$2" />
      <YStack gap={EARN_LIST_ROW_GAP}>
        {Array.from({ length: 3 }).map((_, index) => (
          <XStack key={index} px="$1" py="$2" ai="center" gap="$3">
            <Skeleton width="$14" height="$8" radius="round" />
            <Skeleton width={96} height={24} borderRadius="$2" />
            <YStack flex={1} />
            <Skeleton width={88} height={24} borderRadius="$2" />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

/**
 * Phone Earn home: Pools sits right below Trending tokens. Its rows open the
 * pool page rather than opening in place, so the home stays short
 * (proposal); the full list opens rows in place.
 */
export function EarnPoolsHomeSection() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { result: pools } = usePoolsQuery(PoolsQueries.list());
  const homePools = useMemo(() => pickHomePools(pools ?? []), [pools]);

  if (!pools) {
    return <EarnPoolsHomeSectionSkeleton />;
  }
  if (!homePools.length) {
    return null;
  }

  return (
    <YStack gap="$3">
      <XStack
        testID="earn-home-pools-section"
        role="button"
        minHeight="$12"
        px="$pagePadding"
        py="$1"
        ai="center"
        gap="$1"
        cursor="pointer"
        userSelect="none"
        pressStyle={{ opacity: 0.5 }}
        onPress={() => PoolsNavigation.pushPools(navigation)}
      >
        <SizableText size="$headingLg" pointerEvents="none">
          {intl.formatMessage({ id: ETranslations.global_pools })}
        </SizableText>
        <Icon
          name="ChevronRightSmallOutline"
          size="$5"
          color="$iconSubdued"
          pointerEvents="none"
        />
      </XStack>
      <YStack gap={EARN_LIST_ROW_GAP}>
        {homePools.map((pool) => (
          <PoolListRow key={pool.id} pool={pool} />
        ))}
      </YStack>
    </YStack>
  );
}
