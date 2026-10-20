import { Icon, Stack, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

import { POOLS_COPY } from '../poolsCopy';

import { PoolsChainSelector } from './PoolsChainSelector';
import { PoolsFilterButton } from './PoolsFilterButton';

import type { IPoolsListSort } from './PoolsFilterButton';
import type { IPoolsFilter, IPoolsOptionCounts } from '../poolsFilter';

/** Shows only the starred pools while on */
function PoolsFavoritesToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <Stack
      testID="earn-pools-scope-favorites"
      role="button"
      aria-label={POOLS_COPY.favorites}
      aria-pressed={on}
      w={36}
      h={36}
      ai="center"
      jc="center"
      borderRadius="$full"
      // The surface of the chain pill and Filters beside it
      bg={on ? '$bgActive' : '$bgStrong'}
      cursor="pointer"
      userSelect="none"
      hoverStyle={{ bg: on ? '$bgStrongActive' : '$bgStrongHover' }}
      pressStyle={{ bg: '$bgStrongActive' }}
      onPress={() => onChange(!on)}
    >
      <Icon
        name={on ? 'StarSolid' : 'StarOutline'}
        size="$5"
        color={on ? '$iconActive' : '$iconSubdued'}
      />
    </Stack>
  );
}

/**
 * Phones: one row for the list. The chain pill, the star for Favorites, and
 * Filters, which holds the types and the sort as well.
 */
export function PoolsPhoneFilterBar({
  chainId,
  onChainChange,
  networkCounts,
  favoritesOnly,
  onFavoritesOnlyChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  resultCount,
  optionCounts,
  pt = '$2',
}: {
  chainId?: string;
  onChainChange: (networkId: string | undefined) => void;
  networkCounts: Record<string, number>;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (on: boolean) => void;
  filter: IPoolsFilter;
  onFilterChange: (filter: IPoolsFilter) => void;
  sort: IPoolsListSort;
  onSortChange: (sort: IPoolsListSort) => void;
  resultCount: number;
  /** Pools each Filters option would leave */
  optionCounts?: IPoolsOptionCounts;
  pt?: IXStackProps['pt'];
}) {
  return (
    <XStack px="$pagePadding" pt={pt} pb="$2" gap="$2" ai="center">
      <PoolsChainSelector
        value={chainId}
        onChange={onChainChange}
        networkCounts={networkCounts}
      />
      <PoolsFavoritesToggle
        on={favoritesOnly}
        onChange={onFavoritesOnlyChange}
      />
      <XStack ml="auto">
        <PoolsFilterButton
          testID="earn-pools-filter"
          iconOnly
          value={filter}
          onChange={onFilterChange}
          showCategory
          sort={sort}
          onSortChange={onSortChange}
          resultCount={resultCount}
          optionCounts={optionCounts}
        />
      </XStack>
    </XStack>
  );
}
