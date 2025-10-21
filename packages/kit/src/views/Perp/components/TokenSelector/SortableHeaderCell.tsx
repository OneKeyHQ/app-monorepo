import { memo, useCallback } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { usePerpTokenSortConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IPerpTokenSortConfig,
  IPerpTokenSortField,
} from '@onekeyhq/shared/types/hyperliquid';

interface ISortableHeaderCellProps {
  field: IPerpTokenSortField;
  label: string;
  width?: number;
  flex?: number;
}

function BaseSortableHeaderCell({
  field,
  label,
  width,
  flex,
}: ISortableHeaderCellProps) {
  const [sortConfig, setSortConfig] = usePerpTokenSortConfigPersistAtom();

  const handlePress = useCallback(() => {
    setSortConfig((prev: IPerpTokenSortConfig | null) => {
      if (prev?.field === field) {
        // Same field: toggle direction, or clear sort if already ascending
        if (prev.direction === 'asc') {
          // Clear sort - return to default order
          return null;
        }
        // Toggle to ascending
        return {
          field,
          direction: 'asc',
        };
      }

      // New field, default to descending
      return {
        field,
        direction: 'desc',
      };
    });
  }, [field, setSortConfig]);

  const isActive = sortConfig?.field === field;

  return (
    <XStack
      width={width}
      flex={flex}
      cursor="pointer"
      onPress={handlePress}
      hoverStyle={{ opacity: 0.7 }}
      userSelect="none"
      alignItems="center"
      gap="$0.5"
    >
      <SizableText
        size="$bodySm"
        color={isActive ? '$text' : '$textSubdued'}
        numberOfLines={1}
        flexShrink={1}
      >
        {label}
      </SizableText>
      {isActive ? (
        <Icon
          name={
            sortConfig?.direction === 'asc'
              ? 'ChevronTopOutline'
              : 'ChevronBottomOutline'
          }
          size="$3"
          color="$icon"
          flexShrink={0}
        />
      ) : null}
    </XStack>
  );
}

export const SortableHeaderCell = memo(BaseSortableHeaderCell);
