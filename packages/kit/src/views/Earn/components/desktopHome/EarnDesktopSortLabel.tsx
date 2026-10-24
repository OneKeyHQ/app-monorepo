import { Icon, SizableText, XStack } from '@onekeyhq/components';

import { buildKeyboardPressProps } from './earnDesktopPressable';

export type IEarnDesktopSortDirection = 'asc' | 'desc';

export type IEarnDesktopSortState<TKey extends string> = {
  key: TKey;
  direction: IEarnDesktopSortDirection;
};

// A column's label that sorts the list by it, as the Market list's labels
// do. The Earn and Loans tables share it, so a header reads and answers the
// same on both tabs. No current sort: the list keeps its own order
export function EarnDesktopSortLabel<TKey extends string>({
  children,
  sort,
  current,
  onPress,
  testID,
}: {
  children: string;
  sort: TKey;
  current: IEarnDesktopSortState<TKey> | undefined;
  onPress: (sort: TKey) => void;
  testID?: string;
}) {
  const isActive = current?.key === sort;
  let iconName:
    | 'ChevronGrabberVerOutline'
    | 'ChevronDownSmallOutline'
    | 'ChevronTopSmallOutline' = 'ChevronGrabberVerOutline';
  if (isActive) {
    iconName =
      current.direction === 'desc'
        ? 'ChevronDownSmallOutline'
        : 'ChevronTopSmallOutline';
  }
  const handlePress = () => onPress(sort);
  return (
    <XStack
      testID={testID}
      role="button"
      aria-pressed={isActive}
      ai="center"
      gap="$0.5"
      cursor="pointer"
      userSelect="none"
      hitSlop={8}
      onPress={handlePress}
      {...buildKeyboardPressProps(handlePress, 2)}
    >
      <SizableText
        size="$bodySmMedium"
        color={isActive ? '$text' : '$textSubdued'}
        numberOfLines={1}
      >
        {children}
      </SizableText>
      <Icon
        name={iconName}
        size="$4"
        color={isActive ? '$icon' : '$iconSubdued'}
      />
    </XStack>
  );
}
