import type { ReactNode } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';

// One label/value line of the compact referral cards: a subdued label (with
// an optional leading mark) on the left, the value and its inline actions on
// the right, and an optional hint under the value it explains. These rows
// show facts rather than open pages, so they sit tighter than 44px list rows.
export function CompactFieldRow({
  label,
  leading,
  hint,
  children,
}: {
  label: string;
  leading?: ReactNode;
  hint?: string | null;
  children: ReactNode;
}) {
  return (
    <XStack minHeight={36} py="$1" ai="center" gap="$3">
      <XStack flexShrink={0} ai="center" gap="$2">
        {leading}
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {label}
        </SizableText>
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
