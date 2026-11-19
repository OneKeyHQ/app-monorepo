import type { ComponentProps, ReactNode } from 'react';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { Page } from '@onekeyhq/components';

import { buildKeyboardPressProps } from './earnDesktopPressable';

// A header of two-line fields is taller than a title's, so their roles
// don't sit against the window's top edge. The header view lays this style
// over its own height; the navigator's type for it names the background
// alone
export const EARN_HEADER_PICK_STYLE = { height: 64 } as ComponentProps<
  typeof Page.Header
>['headerStyle'];

/**
 * One pick in the Earn or Loans window's header, as a form's field without
 * its box: its role over what is picked ("Supply" over ETH, "Network" over
 * All networks). Plain type on the header, no fill of its own, so the
 * amount box under it holds the window's only filled token control and the
 * two don't read as the same thing twice
 */
export function EarnHeaderPickCell({
  testID,
  label,
  logo,
  value,
  onPress,
}: {
  testID?: string;
  label: string;
  logo?: ReactNode;
  value: string;
  onPress: () => void;
}) {
  return (
    <YStack
      testID={testID}
      role="button"
      px="$2"
      py="$1"
      minWidth={0}
      flexShrink={1}
      borderRadius="$2"
      borderCurve="continuous"
      userSelect="none"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
      {...buildKeyboardPressProps(onPress, 2)}
    >
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <XStack ai="center" gap="$1.5" h="$6" minWidth={0}>
        {logo}
        <SizableText size="$headingMd" numberOfLines={1} flexShrink={1}>
          {value}
        </SizableText>
        <Icon
          name="ChevronDownSmallOutline"
          size="$4"
          color="$iconSubdued"
          flexShrink={0}
          ml="$-0.5"
        />
      </XStack>
    </YStack>
  );
}

// Between two picks where one leads to the other (what is supplied, what
// is borrowed against it), level with their values
export function EarnHeaderPickArrow() {
  return (
    <XStack
      h="$6"
      ai="center"
      alignSelf="flex-end"
      mb="$1"
      flexShrink={0}
      aria-hidden
    >
      <Icon name="ArrowRightOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}

// The header's picks in a row. The first field's text starts where a plain
// title's would: its hover fill reaches past that edge
export function EarnHeaderPickRow({
  testID,
  children,
}: {
  testID?: string;
  children: ReactNode;
}) {
  return (
    <XStack testID={testID} ai="center" gap="$3" ml="$-2" minWidth={0}>
      {children}
    </XStack>
  );
}

/**
 * The header's right side over the offers' column: the network the offers
 * are from at the column's left edge, as the home's lists keep their
 * network filter over them, and the window's own controls (History) at its
 * right
 */
export function EarnHeaderOffersSide({
  width,
  network,
  children,
}: {
  // The offers' column, without the window's own padding
  width: number;
  network: ReactNode;
  children?: ReactNode;
}) {
  return (
    <XStack w={width} ai="center" jc="space-between" gap="$3">
      <XStack ml="$-2" minWidth={0} flexShrink={1}>
        {network}
      </XStack>
      {children}
    </XStack>
  );
}
