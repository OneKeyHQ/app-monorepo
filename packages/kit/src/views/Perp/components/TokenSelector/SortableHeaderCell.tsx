import { memo, useCallback } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { usePerpTokenSelectorConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IPerpTokenSelectorConfig,
  IPerpTokenSortField,
} from '@onekeyhq/shared/types/hyperliquid';
import {
  DEFAULT_PERP_TOKEN_ACTIVE_TAB,
  DEFAULT_PERP_TOKEN_SORT_DIRECTION,
  DEFAULT_PERP_TOKEN_SORT_FIELD,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

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
  const [selectorConfig, setSelectorConfig] =
    usePerpTokenSelectorConfigPersistAtom();

  const handlePress = useCallback(() => {
    setSelectorConfig((prev: IPerpTokenSelectorConfig | null) => {
      if (prev?.field === field) {
        // Same field: toggle direction, or reset to default sort if already ascending
        if (prev.direction === 'asc') {
          // Reset to default sort but preserve activeTab
          return {
            field: DEFAULT_PERP_TOKEN_SORT_FIELD,
            direction: DEFAULT_PERP_TOKEN_SORT_DIRECTION,
            activeTab: prev.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB,
          };
        }
        // Toggle to ascending
        return {
          field,
          direction: 'asc',
          activeTab: prev.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB,
        };
      }

      // New field, default to descending
      return {
        field,
        direction: DEFAULT_PERP_TOKEN_SORT_DIRECTION,
        activeTab: prev?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB,
      };
    });
  }, [field, setSelectorConfig]);

  const isActive = selectorConfig?.field === field;
  let iconName: string;
  if (isActive && selectorConfig?.direction === 'asc') {
    iconName = 'ChevronTopOutline';
  } else if (isActive) {
    iconName = 'ChevronBottomOutline';
  } else {
    iconName = 'ChevronGrabberVerOutline';
  }

  return (
    <XStack
      group="card"
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
      <Icon
        name={iconName as any}
        size="$3"
        color={isActive ? '$icon' : '$iconSubdued'}
        flexShrink={0}
        $group-card-hover={{
          opacity: isActive ? 1 : 0.6,
        }}
      />
    </XStack>
  );
}

export const SortableHeaderCell = memo(BaseSortableHeaderCell);
