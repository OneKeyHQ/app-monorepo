import { memo, useCallback } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { usePerpTokenSelectorConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IPerpTokenSelectorConfig,
  IPerpTokenSortField,
} from '@onekeyhq/shared/types/hyperliquid';
import { DEFAULT_PERP_TOKEN_ACTIVE_TAB } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import {
  getNextPerpTokenSelectorSortConfig,
  isPerpTokenSelectorSortFieldActive,
} from '../../utils/tokenSelectorTabs';

interface ISortableHeaderCellProps {
  field: IPerpTokenSortField;
  label: string;
  width?: number;
  flex?: number;
  minWidth?: number;
}

function BaseSortableHeaderCell({
  field,
  label,
  width,
  flex,
  minWidth,
}: ISortableHeaderCellProps) {
  const [selectorConfig, setSelectorConfig] =
    usePerpTokenSelectorConfigPersistAtom();
  const headerActiveTab =
    selectorConfig?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
  const isCurrentFieldActive = isPerpTokenSelectorSortFieldActive({
    activeTab: headerActiveTab,
    field,
    sortField: selectorConfig?.field,
    sortSource: selectorConfig?.sortSource,
    sortSourceTab: selectorConfig?.sortSourceTab,
  });

  const handlePress = useCallback(() => {
    const previousField = selectorConfig?.field ?? '';
    const previousDirection = selectorConfig?.direction ?? '';
    const currentActiveTab =
      selectorConfig?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
    const nextConfig = getNextPerpTokenSelectorSortConfig({
      prev: selectorConfig,
      field,
    });

    defaultLogger.perp.tokenSelector.perpTokenSelectorSortClick({
      activeTab: currentActiveTab,
      field: nextConfig.field,
      direction: nextConfig.direction,
      previousField,
      previousDirection,
    });

    setSelectorConfig((prev: IPerpTokenSelectorConfig | null) => {
      return getNextPerpTokenSelectorSortConfig({ prev, field });
    });
  }, [field, selectorConfig, setSelectorConfig]);

  const isActive = isCurrentFieldActive;
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
      flexBasis={typeof flex === 'number' ? 0 : undefined}
      minWidth={minWidth}
      onPress={handlePress}
      hoverStyle={{ opacity: 0.7 }}
      userSelect="none"
      alignItems="center"
      gap="$0.5"
      cursor="default"
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
