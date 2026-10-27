import type { ReactNode } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';

// One label/value line of the compact referral cards: a subdued label (with
// an optional leading mark) on the left, the value and its inline actions on
// the right, and an optional hint under the value it explains. Every row is
// 44px tall: the ones with inline actions (copy, more links) need the touch
// height, and the rest match them so the cards read evenly spaced.
export function CompactFieldRow({
  label,
  leading,
  labelAccessory,
  hint,
  children,
}: {
  label: string;
  leading?: ReactNode;
  // Sits after the label, like an info icon that explains it.
  labelAccessory?: ReactNode;
  hint?: string | null;
  children: ReactNode;
}) {
  return (
    <XStack minHeight={44} py="$1" ai="center" gap="$3">
      <XStack flexShrink={0} ai="center" gap="$2">
        {leading}
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {label}
        </SizableText>
        {labelAccessory}
      </XStack>
      <YStack flex={1} minWidth={0} ai="flex-end" gap="$0.5">
        <XStack maxWidth="100%" ai="center" gap="$1">
          {children}
        </XStack>
        {hint ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {hint}
          </SizableText>
        ) : null}
      </YStack>
    </XStack>
  );
}
