import type { ReactNode } from 'react';

import { Stack, XStack, YStack, useMedia } from '@onekeyhq/components';

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
      <XStack gap="$3" pb="$8" px="$5">
        {primaryCard}
        {secondaryCards}
      </XStack>
    );
  }

  return (
    <YStack gap="$3" pb="$8" px="$5">
      {primaryCard}
      <XStack gap="$3">{secondaryCards}</XStack>
    </YStack>
  );
}

interface IResponsiveThreeColumnLayoutProps {
  firstColumn: ReactNode;
  secondColumn: ReactNode;
  thirdColumn: ReactNode;
  gap?: string;
  px?: string;
}

/**
 * Generic 3-column layout that stacks vertically on narrow screens.
 * Wide screen: 3 equal columns in a row
 * Narrow screen: all columns stacked vertically
 */
export function ResponsiveThreeColumnLayout({
  firstColumn,
  secondColumn,
  thirdColumn,
  gap = '$5',
  px = '$5',
}: IResponsiveThreeColumnLayoutProps) {
  return (
    <Stack
      gap={gap}
      px={px}
      flexDirection="row"
      alignItems="stretch"
      $lg={{
        flexDirection: 'column',
      }}
    >
      <Stack
        flexGrow={1}
        flexShrink={1}
        flexBasis={0}
        $lg={{
          flexGrow: 0,
          flexShrink: 1,
          flexBasis: 'auto',
        }}
      >
        {firstColumn}
      </Stack>

      <Stack
        flexGrow={1}
        flexShrink={1}
        flexBasis={0}
        $lg={{
          flexGrow: 0,
          flexShrink: 1,
          flexBasis: 'auto',
        }}
      >
        {secondColumn}
      </Stack>

      <Stack
        flexGrow={1}
        flexShrink={1}
        flexBasis={0}
        $lg={{
          flexGrow: 0,
          flexShrink: 1,
          flexBasis: 'auto',
        }}
      >
        {thirdColumn}
      </Stack>
    </Stack>
  );
}
