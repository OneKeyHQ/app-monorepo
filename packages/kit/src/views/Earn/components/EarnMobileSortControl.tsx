import { useCallback } from 'react';

import { IconButton, SegmentControl, XStack } from '@onekeyhq/components';

export type IEarnSortDirection = 'asc' | 'desc';

export type IEarnSortOption = {
  label: string;
  value: string;
};

type IEarnMobileSortControlProps = {
  sortKey: string;
  sortDirection: IEarnSortDirection;
  options: IEarnSortOption[];
  onSortChange: (key: string, direction: IEarnSortDirection) => void;
};

export function EarnMobileSortControl({
  sortKey,
  sortDirection,
  options,
  onSortChange,
}: IEarnMobileSortControlProps) {
  const handleSortKeyChange = useCallback(
    (value: string | number) => {
      const nextSortKey = String(value);
      onSortChange(
        nextSortKey,
        nextSortKey === sortKey ? sortDirection : 'desc',
      );
    },
    [onSortChange, sortDirection, sortKey],
  );

  const handleSortDirectionChange = useCallback(() => {
    onSortChange(sortKey, sortDirection === 'desc' ? 'asc' : 'desc');
  }, [onSortChange, sortDirection, sortKey]);

  if (!options.length) {
    return null;
  }

  return (
    <XStack px="$pagePadding" ai="center" gap="$2">
      <SegmentControl
        flex={1}
        fullWidth
        value={sortKey}
        options={options}
        onChange={handleSortKeyChange}
        segmentControlItemStyleProps={{ px: '$2' }}
      />
      <IconButton
        variant="tertiary"
        icon={
          sortDirection === 'desc'
            ? 'ChevronDownSmallOutline'
            : 'ChevronTopSmallOutline'
        }
        iconSize="$5"
        onPress={handleSortDirectionChange}
      />
    </XStack>
  );
}
