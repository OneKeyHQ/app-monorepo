import type { ReactNode } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';

import {
  POINTER_ROW_BLEED_PROPS,
  PRESSABLE_SURFACE_PROPS,
} from './useInviteCardStyle';

// A label over its value, the bottom row of both desktop invite cards, so
// the two rows line up side by side.
export function InviteStatCell({
  label,
  leading,
  labelAccessory,
  children,
  onPress,
  testID,
  share = 1,
  shrink = true,
  minWidth,
}: {
  label: string;
  leading?: ReactNode;
  // Sits after the label, like an info icon that explains it.
  labelAccessory?: ReactNode;
  children: ReactNode;
  onPress?: () => void;
  testID?: string;
  // Width share of the row; a zero basis keeps the split fixed, so masking
  // the address does not resize the cells. 'content' sizes the cell to what
  // it holds, so a lone pressable cell's hover surface stays on it.
  share?: number | 'content';
  // When false, the cell prefers its content width and can still shrink
  // inside the row, so the address controls stay in the card.
  shrink?: boolean;
  // Floor for amount cells, so they do not collapse to nothing.
  minWidth?: number | `$${string}`;
}) {
  const hug = share === 'content' || !shrink;
  let sizing:
    | { flexShrink: number }
    | { flex: number; flexBasis: number }
    | {
        flexGrow: number;
        flexShrink: number;
        flexBasis: 'auto';
      };
  if (!hug) {
    sizing = { flex: share, flexBasis: 0 };
  } else if (shrink) {
    sizing = { flexShrink: 1 };
  } else {
    sizing = { flexGrow: 0, flexShrink: 1, flexBasis: 'auto' };
  }
  return (
    <XStack
      testID={testID}
      {...sizing}
      minWidth={minWidth ?? 0}
      ai="center"
      gap="$2"
      py="$1"
      borderRadius="$2"
      // Pressable cells get a padded hover surface that keeps text aligned.
      {...(onPress
        ? { ...PRESSABLE_SURFACE_PROPS, ...POINTER_ROW_BLEED_PROPS }
        : null)}
      onPress={onPress}
    >
      <YStack flex={hug ? undefined : 1} flexShrink={1} gap="$1" minWidth={0}>
        <XStack ai="center" gap="$2">
          {leading}
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {label}
          </SizableText>
          {labelAccessory}
        </XStack>
        {children}
      </YStack>
    </XStack>
  );
}
