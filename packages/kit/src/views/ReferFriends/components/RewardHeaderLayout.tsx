import type { ReactNode } from 'react';

import { XStack, YStack, useMedia } from '@onekeyhq/components';

interface IRewardHeaderLayoutProps {
  primaryCard: ReactNode;
  secondaryCards: ReactNode;
}

/**
 * Layout for reward header with 1 primary card + 2 secondary cards.
 * Wide screen: 3 cards in a row
 * Narrow screen: primary card on top, 2 secondary cards in a row below
 */
export function RewardHeaderLayout({
  primaryCard,
  secondaryCards,
}: IRewardHeaderLayoutProps) {
  const { md } = useMedia();
  const isWideScreen = !md;

  if (isWideScreen) {
    return (
      <XStack gap="$4" pb="$6" px="$5">
        {primaryCard}
        {secondaryCards}
      </XStack>
    );
  }

  return (
    <YStack gap="$3" pb="$6" px="$5">
      {primaryCard}
      <XStack gap="$3">{secondaryCards}</XStack>
    </YStack>
  );
}
