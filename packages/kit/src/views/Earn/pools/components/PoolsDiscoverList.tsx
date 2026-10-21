import { memo, useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  IPoolListItem,
  IPoolStatsWindow,
} from '@onekeyhq/shared/types/pools';

import { EarnAprSuffixText } from '../../components/EarnAprSuffixText';
import { POOLS_COPY } from '../poolsCopy';
import { POOL_CATEGORIES } from '../poolsFilter';
import {
  formatCompactUsd,
  formatPercent,
  getPoolPairTitle,
} from '../poolsFormat';
import { PoolsNavigation } from '../poolsNavigation';
import { prefetchPoolOverview } from '../poolsQueries';

import { PoolExpandedPanel, PoolStarButton } from './PoolOverview';
import { PoolPairIcon } from './PoolPairIcon';
import { POOLS_CATEGORY_LABELS, PoolsChip } from './PoolsFilterButton';
import { PoolsSortHeader } from './PoolsSortHeader';
import { PoolChangeText } from './PoolStats';
import { PoolTags } from './PoolTags';

import type { IPoolsCategory, IPoolsSortKey } from '../poolsFilter';

export const POOL_STATS_WINDOWS: IPoolStatsWindow[] = ['1D', '1W', '1M'];

export type IPoolsScope = 'all' | 'favorites' | IPoolsCategory;

/** The type a scope chip stands for; All and Favorites have none */
export function getScopeCategory(scope: IPoolsScope) {
  return POOL_CATEGORIES.find((category) => category === scope);
}

/**
 * All, the starred pools, then the types (wide screens). One at a time; a
 * type that would leave no pools is greyed out.
 */
export function PoolsScopeChips({
  scope,
  onChange,
  categoryCounts,
}: {
  scope: IPoolsScope;
  onChange: (scope: IPoolsScope) => void;
  /** Pools each type would leave */
  categoryCounts?: Record<IPoolsCategory, number>;
}) {
  return (
    <XStack gap="$2" rowGap="$2" ai="center" flex={1} flexWrap="wrap">
      <PoolsChip
        testID="earn-pools-scope-all"
        label={POOLS_COPY.allPools}
        active={scope === 'all'}
        onPress={() => onChange('all')}
      />
      <PoolsChip
        testID="earn-pools-scope-favorites"
        label={POOLS_COPY.favorites}
        icon={
          <Icon
            name={scope === 'favorites' ? 'StarSolid' : 'StarOutline'}
            size="$4"
            color={scope === 'favorites' ? '$iconActive' : '$iconSubdued'}
          />
        }
        active={scope === 'favorites'}
        onPress={() => onChange('favorites')}
      />
      {POOL_CATEGORIES.map((category) => (
        <PoolsChip
          key={category}
          testID={`earn-pools-scope-${category}`}
          label={POOLS_CATEGORY_LABELS[category]}
          active={scope === category}
          disabled={scope !== category && categoryCounts?.[category] === 0}
          onPress={() => onChange(category)}
        />
      ))}
    </XStack>
  );
}

/** The window the volume, fees and APR columns cover (Revert's 24h/7d/30d) */
export function PoolsPeriodPills({
  period,
  onChange,
}: {
  period: IPoolStatsWindow;
  onChange: (period: IPoolStatsWindow) => void;
}) {
  return (
    <XStack gap="$1" ai="center">
      {POOL_STATS_WINDOWS.map((item) => (
        <Button
          key={item}
          testID={`earn-pools-period-${item}`}
          size="small"
          variant={period === item ? 'secondary' : 'tertiary'}
          minWidth={42}
          // The type chips' height, on the same line
          height={28}
          m="$0"
          px="$2.5"
          borderWidth={0}
          borderRadius="$full"
          onPress={() => onChange(item)}
        >
          {item}
        </Button>
      ))}
    </XStack>
  );
}

function ValueCell({
  value,
  change,
  changeInPoints,
  flex = 1,
}: {
  value: string;
  change?: string;
  changeInPoints?: boolean;
  flex?: number;
}) {
  return (
    <YStack flex={flex} flexBasis={0} ai="flex-end" gap="$0.5" minWidth={0}>
      <SizableText size="$bodyLgMedium" numberOfLines={1}>
        {value}
      </SizableText>
      <PoolChangeText change={change} points={changeInPoints} />
    </YStack>
  );
}

const STAR_WIDTH = 32;
const CHEVRON_WIDTH = 20;

/**
 * The pair, then the fee and DEX badges under it. The chain is the badge on
 * the pair icon.
 */
function PoolCell({ pool }: { pool: IPoolListItem }) {
  return (
    <XStack ai="center" gap="$3" minWidth={0} flexShrink={1}>
      <PoolPairIcon pool={pool} size="md" />
      <YStack gap="$1" minWidth={0} flexShrink={1}>
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {getPoolPairTitle(pool)}
        </SizableText>
        <PoolTags pool={pool} />
      </YStack>
    </XStack>
  );
}

const PoolTableRow = memo(
  ({
    pool,
    period,
    expanded,
    onToggle,
  }: {
    pool: IPoolListItem;
    period: IPoolStatsWindow;
    expanded: boolean;
    onToggle: (poolId: string) => void;
  }) => {
    const stats = pool.windows[period];
    return (
      <YStack>
        <ListItem
          testID={`earn-pools-row-${pool.id}`}
          gap="$3"
          py="$3"
          aria-expanded={expanded}
          bg={expanded ? '$bgActive' : undefined}
          onHoverIn={() => prefetchPoolOverview(pool)}
          onPress={() => onToggle(pool.id)}
        >
          <Stack width={STAR_WIDTH} ai="center">
            <PoolStarButton poolId={pool.id} />
          </Stack>
          <XStack flex={2.8} flexBasis={0} minWidth={0}>
            <PoolCell pool={pool} />
          </XStack>
          <ValueCell
            value={formatCompactUsd(pool.tvlUsd)}
            change={stats.tvlChange}
          />
          <ValueCell
            value={formatCompactUsd(stats.volumeUsd)}
            change={stats.volumeChange}
          />
          <ValueCell
            value={formatCompactUsd(stats.feesUsd)}
            change={stats.feesChange}
          />
          <ValueCell
            value={formatPercent(stats.apr)}
            change={stats.aprChange}
            changeInPoints
          />
          <Icon
            width={CHEVRON_WIDTH}
            name={
              expanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
            }
            size="$5"
            color="$iconSubdued"
          />
        </ListItem>
        {expanded ? (
          <YStack px="$5" pt="$4" pb="$8">
            <PoolExpandedPanel pool={pool} />
          </YStack>
        ) : null}
      </YStack>
    );
  },
);
PoolTableRow.displayName = 'PoolTableRow';

/**
 * Revert-style pools table for wide screens: TVL, volume, fees and APR over
 * the chosen window, each with its change. A row opens in place to the
 * pool's data and the create form; one row is open at a time.
 */
export function PoolsDiscoverTable({
  pools,
  period,
  sortKey,
  sortDirection,
  onSortChange,
  expandedId,
  onToggle,
  empty,
}: {
  pools: IPoolListItem[];
  period: IPoolStatsWindow;
  sortKey: IPoolsSortKey;
  sortDirection: 'asc' | 'desc';
  onSortChange: (key: IPoolsSortKey, direction: 'asc' | 'desc') => void;
  expandedId: string | undefined;
  onToggle: (poolId: string) => void;
  empty?: ReactNode;
}) {
  const header = (
    <ListItem gap="$3" py="$1" minHeight="$8">
      <Stack width={STAR_WIDTH} />
      <SizableText
        flex={2.8}
        flexBasis={0}
        size="$bodySmMedium"
        color="$textSubdued"
      >
        {POOLS_COPY.pool}
      </SizableText>
      <PoolsSortHeader
        label={POOLS_COPY.tvl}
        sortKey="tvl"
        activeKey={sortKey}
        direction={sortDirection}
        onSort={onSortChange}
        testID="earn-pools-sort-tvl"
        flex={1}
      />
      <PoolsSortHeader
        label={POOLS_COPY.volume}
        sortKey="volume"
        activeKey={sortKey}
        direction={sortDirection}
        onSort={onSortChange}
        testID="earn-pools-sort-volume"
        flex={1}
      />
      <PoolsSortHeader
        label={POOLS_COPY.fees}
        sortKey="fees"
        activeKey={sortKey}
        direction={sortDirection}
        onSort={onSortChange}
        testID="earn-pools-sort-fees"
        flex={1}
      />
      <PoolsSortHeader
        label={POOLS_COPY.apr}
        sortKey="apr"
        activeKey={sortKey}
        direction={sortDirection}
        onSort={onSortChange}
        testID="earn-pools-sort-apr"
        flex={1}
      />
      <Stack width={CHEVRON_WIDTH} />
    </ListItem>
  );
  return (
    <YStack testID="earn-pools-table">
      {header}
      {pools.length
        ? pools.map((pool) => (
            <PoolTableRow
              key={pool.id}
              pool={pool}
              period={period}
              expanded={expandedId === pool.id}
              onToggle={onToggle}
            />
          ))
        : empty}
    </YStack>
  );
}

/**
 * A phone row: star, pair and badges, then the 24h APR over TVL. It opens
 * the pool page, where the footer creates a position.
 */
export const PoolListRow = memo(({ pool }: { pool: IPoolListItem }) => {
  const navigation = useAppNavigation();
  return (
    <ListItem
      testID={`earn-pools-item-${pool.id}`}
      userSelect="none"
      gap="$2"
      // Not onPressIn: on native, ListItem leaves it on the inner view, which
      // then takes the touch and the press never fires
      onPress={() => {
        prefetchPoolOverview(pool);
        PoolsNavigation.pushPoolDetails(navigation, pool.id);
      }}
    >
      <Stack ml="$-1.5">
        <PoolStarButton poolId={pool.id} />
      </Stack>
      <XStack flex={1} minWidth={0}>
        <PoolCell pool={pool} />
      </XStack>
      <YStack ai="flex-end" jc="center" gap="$0.5" flexShrink={0}>
        <EarnAprSuffixText
          text={`${formatPercent(pool.windows['1D'].apr)} ${POOLS_COPY.apr}`}
        />
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {`${formatCompactUsd(pool.tvlUsd)} ${POOLS_COPY.tvl}`}
        </SizableText>
      </YStack>
    </ListItem>
  );
});
PoolListRow.displayName = 'PoolListRow';

/** One open row at a time; opening another closes the first */
export function useExpandedPool() {
  const [expandedId, setExpandedId] = useState<string>();
  const toggle = useCallback(
    (poolId: string) =>
      setExpandedId((current) => (current === poolId ? undefined : poolId)),
    [],
  );
  return { expandedId, toggle };
}
