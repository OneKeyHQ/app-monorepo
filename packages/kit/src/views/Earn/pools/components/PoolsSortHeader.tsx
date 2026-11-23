import { useState } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';

/**
 * A sortable column's name and arrow, the active column in full color. The
 * arrow sits on the column's inner side: before a right-aligned name, after
 * a left-aligned one. Without `onSort` toggling, a column only sorts down.
 */
export function PoolsSortHeader<K extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = 'right',
  descendingOnly = false,
  testID,
  flex,
}: {
  label: string;
  sortKey: K;
  activeKey: K;
  direction: 'asc' | 'desc';
  onSort: (key: K, direction: 'asc' | 'desc') => void;
  align?: 'left' | 'right';
  /** A ranking: highest first is the only order that makes sense */
  descendingOnly?: boolean;
  testID: string;
  /** The column's share of its row */
  flex?: number;
}) {
  const active = sortKey === activeKey;
  // Dimming the whole header on hover made the picked column darker than
  // the idle ones right after a click, as if the click had missed
  const [hovered, setHovered] = useState(false);
  const lit = active || hovered;
  const icon: IKeyOfIcons =
    active && direction === 'asc'
      ? 'ChevronTopSmallOutline'
      : 'ChevronDownSmallOutline';
  const arrow = (
    <Icon name={icon} size="$4.5" color={lit ? '$icon' : '$iconSubdued'} />
  );
  const next = active && direction === 'desc' && !descendingOnly;
  return (
    <XStack
      testID={testID}
      role="button"
      ai="center"
      jc={align === 'right' ? 'flex-end' : 'flex-start'}
      gap="$1"
      cursor="pointer"
      userSelect="none"
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={() => {
        onSort(sortKey, next ? 'asc' : 'desc');
      }}
      {...(flex === undefined ? {} : { flex, flexBasis: 0 })}
    >
      {align === 'right' ? arrow : null}
      <SizableText
        size="$bodySmMedium"
        color={lit ? '$text' : '$textSubdued'}
        numberOfLines={1}
      >
        {label}
      </SizableText>
      {align === 'left' ? arrow : null}
    </XStack>
  );
}
