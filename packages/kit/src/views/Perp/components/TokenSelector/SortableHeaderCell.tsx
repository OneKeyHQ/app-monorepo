import { memo, useCallback, useMemo } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import {
  type IPerpTokenSortField,
  usePerpTokenSortConfigPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

interface ISortableHeaderCellProps {
  field: IPerpTokenSortField;
  label: string;
  width?: number;
  flex?: number;
  align?: 'left' | 'right';
}

function BaseSortableHeaderCell({
  field,
  label,
  width,
  flex,
  align = 'left',
}: ISortableHeaderCellProps) {
  const [sortConfig, setSortConfig] = usePerpTokenSortConfigPersistAtom();

  const handlePress = useCallback(() => {
    setSortConfig((prev) => {
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
  const justifyContent = useMemo(() => {
    if (align === 'right') {
      return 'flex-end';
    }
    return 'flex-start';
  }, [align]);

  return (
    <XStack
      width={width}
      flex={flex}
      justifyContent={justifyContent}
      cursor="pointer"
      onPress={handlePress}
      hoverStyle={{ opacity: 0.7 }}
      userSelect="none"
      alignItems="center"
      gap="$0.5"
    >
      {align === 'right' && isActive ? (
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
      <SizableText
        size="$bodySm"
        color={isActive ? '$text' : '$textSubdued'}
        numberOfLines={1}
        flexShrink={1}
      >
        {label}
      </SizableText>
      {align !== 'right' && isActive ? (
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
