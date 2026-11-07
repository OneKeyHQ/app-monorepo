import type { ReactNode } from 'react';

import Animated from 'react-native-reanimated';

import { SizableText, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import {
  MOTION_MICRO_ENTERING_AFTER_EXIT,
  MOTION_ROW_LAYOUT,
} from './motionTokens';

// Rows sit on a 20pt text line inside a card with a 12pt row gap. A tappable
// row grows its pressed fill by 6pt each way (inner padding cancelled by a
// negative margin, so the row doesn't move) and its touch target by 6pt more
// of slop: 44pt, stopping at the gap's midpoint so neighbors never overlap.
// The fill sits 8pt inside the card's 16pt padding, so its radius is the
// card's 12 minus that 8: a concentric 4.
const PRESSABLE_ROW: IXStackProps = {
  mx: '$-2',
  px: '$2',
  my: '$-1.5',
  py: '$1.5',
  borderRadius: '$1',
  hitSlop: { top: 6, bottom: 6 },
};

// The value + ⓘ trigger of an explainer popover sits on the same 20pt line:
// 12pt of slop makes it a 44pt target that still stops inside the row gap.
export const INFO_TRIGGER_HIT_SLOP = {
  top: 12,
  bottom: 12,
  left: 12,
  right: 12,
};

// Shared label/value row for the review card and the order card — one
// definition so the two surfaces can't drift. A tappable row's pressed fill
// wraps its content with an inset and rounded corners instead of a hard band
// flush with the text. The label keeps its width and the value gives way
// (wrapping or truncating, per value), so a long value — a large payout, a
// long account name — never runs into the label or past the card.
export function DetailRow({
  label,
  children,
  onPress,
}: {
  label: string;
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <XStack
      jc="space-between"
      ai="center"
      gap="$3"
      onPress={onPress}
      {...(onPress
        ? {
            ...PRESSABLE_ROW,
            role: 'button' as const,
            hoverStyle: { bg: '$bgHover' },
            pressStyle: { bg: '$bgActive' },
            cursor: 'pointer' as const,
          }
        : {})}
    >
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      <XStack flexShrink={1} jc="flex-end">
        {children}
      </XStack>
    </XStack>
  );
}

// Wraps every item of a stack whose items can come and go — a card's rows (a
// late row on the review card, a status change on the order card), the lines
// under the order status badge: the items around a change glide instead of
// jumping, and a new item fades in once they have made room (see
// MOTION_ROW_LAYOUT). Wrap the always-present items too — they are the ones
// that move. Items mounted with their container should not fade on their
// own: put them under a LayoutAnimationConfig skipEntering.
export function DetailRowMotion({ children }: { children: ReactNode }) {
  return (
    <Animated.View
      entering={MOTION_MICRO_ENTERING_AFTER_EXIT}
      layout={MOTION_ROW_LAYOUT}
    >
      {children}
    </Animated.View>
  );
}

// "Account name · 0x1234…89ab". The address is what the user checks, so it
// never truncates; a long account name truncates first. The address keeps
// only its first 6 and last 4 characters — enough to recognize it — which
// leaves room for a typical account name ("Account #3") beside the long
// "Receiving address" label (the default 8 + 6 left it four letters).
export function DetailAddressValue({
  address,
  accountName,
}: {
  address: string;
  accountName?: string;
}) {
  const shortAddress = accountUtils.shortenAddress({
    address,
    leadingLength: 6,
    trailingLength: 4,
  });
  return (
    <XStack flexShrink={1}>
      {accountName ? (
        <SizableText size="$bodyMd" numberOfLines={1} flexShrink={1}>
          {accountName}
        </SizableText>
      ) : null}
      <SizableText size="$bodyMd" flexShrink={0}>
        {accountName ? ` · ${shortAddress}` : shortAddress}
      </SizableText>
    </XStack>
  );
}

// A value no quote answers (failed, or handed to the web widget). A skeleton
// there would read as still loading; the row stays mounted so a retry fills
// it in place.
export function DetailEmptyValue() {
  return (
    <SizableText size="$bodyMd" color="$textSubdued">
      --
    </SizableText>
  );
}

// Card shell shared by the review breakdown and the order detail.
export const DETAIL_CARD_PROPS = {
  bg: '$bgSubdued',
  borderRadius: '$3',
  p: '$4',
  gap: '$3',
} as const;

export function formatPrice(value: number) {
  return numberFormat(String(value), {
    formatter: 'price',
    formatterOptions: { currency: '$' },
  });
}
