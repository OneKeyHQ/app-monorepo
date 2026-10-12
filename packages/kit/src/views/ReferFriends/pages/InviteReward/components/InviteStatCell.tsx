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
  children,
  onPress,
  testID,
  share = 1,
  shrink = true,
}: {
  label: string;
  leading?: ReactNode;
  children: ReactNode;
  onPress?: () => void;
  testID?: string;
  // Width share of the row; a zero basis keeps the split fixed, so masking
  // the address does not resize the cells. 'content' sizes the cell to what
  // it holds, so a lone pressable cell's hover surface stays on it.
  share?: number | 'content';
  // When false, the cell keeps its content width and its neighbors shrink
  // first. A payout address uses this so its tail is not the part cut off.
  shrink?: boolean;
}) {
  const hug = share === 'content' || !shrink;
  const sizing = hug
    ? { flexShrink: shrink ? 1 : 0 }
    : { flex: share, flexBasis: 0 };
  return (
    <XStack
      testID={testID}
      {...sizing}
      {...(shrink ? { minWidth: 0 } : null)}
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
      <YStack
        flex={hug ? undefined : 1}
        flexShrink={shrink ? 1 : 0}
        gap="$1"
        {...(shrink ? { minWidth: 0 } : null)}
      >
        <XStack ai="center" gap="$2">
          {leading}
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {label}
          </SizableText>
        </XStack>
        {children}
      </YStack>
    </XStack>
  );
}
