import { useCallback } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';

export type IMarketSortOrder = 'asc' | 'desc' | undefined;

export interface IMarketSortState {
  field?: string;
  order?: IMarketSortOrder;
}

// Matches the table's own cycle: unsorted → desc → asc → unsorted.
export function getNextMarketSortOrder(
  current: IMarketSortOrder,
): IMarketSortOrder {
  if (current === 'desc') {
    return 'asc';
  }
  if (current === 'asc') {
    return undefined;
  }
  return 'desc';
}

function SortSegment({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: string;
  sort: IMarketSortState;
  onSort: (field: string, order: IMarketSortOrder) => void;
}) {
  const order = sort.field === field ? sort.order : undefined;
  const handlePress = useCallback(() => {
    onSort(field, getNextMarketSortOrder(order));
  }, [field, onSort, order]);

  let iconName:
    | 'ChevronDownSmallOutline'
    | 'ChevronTopSmallOutline'
    | 'ChevronGrabberVerOutline' = 'ChevronGrabberVerOutline';
  if (order === 'desc') {
    iconName = 'ChevronDownSmallOutline';
  } else if (order === 'asc') {
    iconName = 'ChevronTopSmallOutline';
  }

  return (
    <XStack
      alignItems="center"
      gap="$0.5"
      cursor="pointer"
      userSelect="none"
      onPress={handlePress}
    >
      <SizableText
        size="$bodySmMedium"
        color={order ? '$text' : '$textSubdued'}
        numberOfLines={1}
      >
        {label}
      </SizableText>
      <Icon
        name={iconName}
        size="$3.5"
        color={order ? '$iconActive' : '$iconSubdued'}
      />
    </XStack>
  );
}

/**
 * A header that carries two independent sort controls in one column — the
 * design's `MCap ⇅ /Price ⇅`. The table's own sorting keys off a single
 * `dataIndex`, so such a column opts out of it and drives the list's sort
 * state from these segments instead.
 */
export function MarketSplitSortHeader({
  segments,
  sort,
  onSort,
}: {
  segments: { field: string; label: string }[];
  sort: IMarketSortState;
  onSort: (field: string, order: IMarketSortOrder) => void;
}) {
  return (
    <XStack alignItems="center" minWidth={0}>
      {segments.map((segment) => (
        <SortSegment
          key={segment.field}
          label={segment.label}
          field={segment.field}
          sort={sort}
          onSort={onSort}
        />
      ))}
    </XStack>
  );
}
