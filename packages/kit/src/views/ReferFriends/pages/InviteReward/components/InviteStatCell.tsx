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
}: {
  label: string;
  leading?: ReactNode;
  children: ReactNode;
  onPress?: () => void;
  testID?: string;
  // Width share of the row. A zero basis keeps the split fixed, so masking
  // the address does not resize the cells.
  share?: number;
}) {
  return (
    <XStack
      testID={testID}
      flex={share}
      flexBasis={0}
      minWidth={0}
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
      <YStack flex={1} gap="$1" minWidth={0}>
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
