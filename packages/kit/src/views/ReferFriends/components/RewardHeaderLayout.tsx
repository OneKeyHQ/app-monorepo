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

interface IResponsiveColumnLayoutProps {
  columns: readonly ReactNode[];
  gap?: string;
  pb?: string;
  px?: string;
}

interface IResponsiveThreeColumnLayoutProps {
  firstColumn: ReactNode;
  secondColumn: ReactNode;
  thirdColumn: ReactNode;
  gap?: string;
  pb?: string;
  px?: string;
}

interface IResponsiveFourColumnLayoutProps extends IResponsiveThreeColumnLayoutProps {
  fourthColumn: ReactNode;
}

/**
 * Generic equal-column layout that stacks vertically on narrow screens.
 * Wide screen: equal columns in a row
 * Narrow screen: all columns stacked vertically
 */
function ResponsiveColumnLayout({
  columns,
  gap = '$5',
  pb,
  px = '$5',
}: IResponsiveColumnLayoutProps) {
  return (
    <Stack
      gap={gap}
      pb={pb}
      px={px}
      flexDirection="row"
      alignItems="stretch"
      $lg={{
        flexDirection: 'column',
      }}
    >
      {columns.map((column, index) => (
        <Stack
          key={index}
          flexGrow={1}
          flexShrink={1}
          flexBasis={0}
          $lg={{
            flexGrow: 0,
            flexShrink: 1,
            flexBasis: 'auto',
          }}
        >
          {column}
        </Stack>
      ))}
    </Stack>
  );
}

export function ResponsiveThreeColumnLayout({
  firstColumn,
  secondColumn,
  thirdColumn,
  gap,
  pb,
  px,
}: IResponsiveThreeColumnLayoutProps) {
  return (
    <ResponsiveColumnLayout
      columns={[firstColumn, secondColumn, thirdColumn]}
      gap={gap}
      pb={pb}
      px={px}
    />
  );
}

export function ResponsiveFourColumnLayout({
  firstColumn,
  secondColumn,
  thirdColumn,
  fourthColumn,
  gap,
  pb,
  px,
}: IResponsiveFourColumnLayoutProps) {
  return (
    <ResponsiveColumnLayout
      columns={[firstColumn, secondColumn, thirdColumn, fourthColumn]}
      gap={gap}
      pb={pb}
      px={px}
    />
  );
}
