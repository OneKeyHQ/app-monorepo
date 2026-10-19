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
import type { IKeyOfIcons } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type {
  IPoolListItem,
  IPoolStatsWindow,
} from '@onekeyhq/shared/types/pools';

import { EarnAprSuffixText } from '../../components/EarnAprSuffixText';
import { POOLS_COPY } from '../poolsCopy';
import {
  formatCompactUsd,
  formatPercent,
  getPoolPairTitle,
} from '../poolsFormat';
import { prefetchPoolOverview } from '../poolsQueries';

import { PoolExpandedPanel, PoolStarButton } from './PoolOverview';
import { PoolPairIcon } from './PoolPairIcon';
import { PoolsChip } from './PoolsFilterButton';
import { PoolChangeText } from './PoolStats';
import { PoolBadgeRow } from './PoolTags';

import type { IPoolsSortKey } from '../poolsFilter';

export const POOL_STATS_WINDOWS: IPoolStatsWindow[] = ['1D', '1W', '1M'];

export type IPoolsScope = 'all' | 'favorites' | 'stocks';

/** All, the starred pools, or stock pools */
export function PoolsScopeChips({
  scope,
  onChange,
}: {
  scope: IPoolsScope;
  onChange: (scope: IPoolsScope) => void;
}) {
  return (
    <XStack gap="$2" ai="center">
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
      <PoolsChip
        testID="earn-pools-scope-stocks"
        label={POOLS_COPY.stocks}
        active={scope === 'stocks'}
        onPress={() => onChange('stocks')}
      />
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
          height={30}
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
  flex = 1,
}: {
  value: string;
  /** Left out, the line stays empty so values keep one baseline */
  change?: string;
  flex?: number;
}) {
  return (
    <YStack flex={flex} flexBasis={0} ai="flex-end" gap="$0.5" minWidth={0}>
      <SizableText size="$bodyLgMedium" numberOfLines={1}>
        {value}
      </SizableText>
      {change === undefined ? (
        <SizableText size="$bodySm"> </SizableText>
      ) : (
        <PoolChangeText change={change} />
      )}
    </YStack>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: IPoolsSortKey;
  activeKey: IPoolsSortKey;
  direction: 'asc' | 'desc';
  onSort: (key: IPoolsSortKey, direction: 'asc' | 'desc') => void;
}) {
  const active = sortKey === activeKey;
  const icon: IKeyOfIcons =
    active && direction === 'asc'
      ? 'ChevronTopSmallOutline'
      : 'ChevronDownSmallOutline';
  return (
    <XStack
      testID={`earn-pools-sort-${sortKey}`}
      group
      flex={1}
      flexBasis={0}
      role="button"
      ai="center"
      jc="flex-end"
      gap="$1"
      cursor="pointer"
      userSelect="none"
      hoverStyle={{ opacity: 0.7 }}
      onPress={() =>
        onSort(sortKey, active && direction === 'desc' ? 'asc' : 'desc')
      }
    >
      {/* Only the sorted column shows its arrow; the rest on hover */}
      <Stack opacity={active ? 1 : 0} $group-hover={{ opacity: 1 }}>
        <Icon
          name={icon}
          size="$4.5"
          color={active ? '$icon' : '$iconSubdued'}
        />
      </Stack>
      <SizableText
        size="$bodySmMedium"
        color={active ? '$text' : '$textSubdued'}
      >
        {label}
      </SizableText>
    </XStack>
  );
}

const STAR_WIDTH = 32;
const CHEVRON_WIDTH = 20;

/** The pair, then fee, chain and DEX badges under it */
function PoolCell({ pool }: { pool: IPoolListItem }) {
  return (
    <XStack ai="center" gap="$3" minWidth={0} flexShrink={1}>
      <PoolPairIcon pool={pool} size="md" />
      <YStack gap="$1" minWidth={0} flexShrink={1}>
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {getPoolPairTitle(pool)}
        </SizableText>
        <PoolBadgeRow pool={pool} />
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
          {/* At a fixed fee, fees move exactly with volume */}
          <ValueCell
            value={formatCompactUsd(stats.feesUsd)}
            change={pool.isDynamicFee ? stats.feesChange : undefined}
          />
          <ValueCell
            value={formatPercent(stats.apr)}
            change={stats.aprChange}
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
            <PoolExpandedPanel pool={pool} wide />
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
      <SortHeader
        label={POOLS_COPY.tvl}
        sortKey="tvl"
        activeKey={sortKey}
        direction={sortDirection}
        onSort={onSortChange}
      />
      <SortHeader
        label={POOLS_COPY.volume}
        sortKey="volume"
        activeKey={sortKey}
        direction={sortDirection}
        onSort={onSortChange}
      />
      <SortHeader
        label={POOLS_COPY.fees}
        sortKey="fees"
        activeKey={sortKey}
        direction={sortDirection}
        onSort={onSortChange}
      />
      <SortHeader
        label={POOLS_COPY.apr}
        sortKey="apr"
        activeKey={sortKey}
        direction={sortDirection}
        onSort={onSortChange}
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
 * A phone row: star, pair and badges, then the 24h APR over TVL. In the
 * lists it opens in place to tabs for the pool's data and the create form.
 */
export const PoolListRow = memo(
  ({
    pool,
    expanded,
    onPress,
  }: {
    pool: IPoolListItem;
    expanded: boolean;
    onPress: (poolId: string) => void;
  }) => (
    <YStack>
      <ListItem
        testID={`earn-pools-item-${pool.id}`}
        userSelect="none"
        gap="$2"
        aria-expanded={expanded}
        bg={expanded ? '$bgActive' : undefined}
        onPress={() => onPress(pool.id)}
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
      {expanded ? (
        <YStack px="$5" pt="$3" pb="$6">
          <PoolExpandedPanel pool={pool} wide={false} />
        </YStack>
      ) : null}
    </YStack>
  ),
);
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
