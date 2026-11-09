import type { ReactNode } from 'react';

import { XStack } from '@onekeyhq/components';

// Pointer layouts: the reward page's primary stat tile and two secondary
// tiles in one row. Compact layouts use RewardSummaryCard instead.
export function RewardHeaderLayout({
  primaryCard,
  secondaryCards,
}: {
  primaryCard: ReactNode;
  secondaryCards: ReactNode;
}) {
  return (
    <XStack gap="$4" pb="$6" px="$5">
      {primaryCard}
      {secondaryCards}
    </XStack>
  );
}
