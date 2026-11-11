import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

import {
  PROPORTIONAL_NUMS,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';

import {
  getTickingPlaces,
  getTickingStepSeconds,
  splitTickingValue,
} from './earnTicking.utils';
import { EarnTickingDigits } from './EarnTickingDigits';

import type { LayoutChangeEvent } from 'react-native';

const SECONDS_PER_DAY = 24 * 60 * 60;
const MIN_TICK_MS = 1000;
const MAX_TICK_MS = 60_000;
// How far a hidden amount's asterisks drop, as a share of their size
export const ASTERISK_DROP = 0.16;

// The total keeps moving between refreshes at the estimated daily change's
// per-second rate. It shows as many places as it takes for the last one to
// be seen moving (the cents alone when they move often enough, or when no
// place allowed would), and re-renders about when that place changes, between
// once a second and once a minute. It stands still while hidden, loading or
// off screen
function useTickingTotal(total: number, change24h: number, isRunning: boolean) {
  const perSecond = change24h > 0 ? change24h / SECONDS_PER_DAY : 0;
  const places = getTickingPlaces(perSecond);
  const [anchor, setAnchor] = useState(() => ({ total, at: Date.now() }));
  const [now, setNow] = useState(() => Date.now());
  if (anchor.total !== total) {
    setAnchor({ total, at: Date.now() });
  }
  const tickMs =
    perSecond > 0 && isRunning
      ? Math.min(
          MAX_TICK_MS,
          Math.max(
            MIN_TICK_MS,
            getTickingStepSeconds(perSecond, places) * 1000,
          ),
        )
      : 0;
  useEffect(() => {
    if (!tickMs) {
      return undefined;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);
  const elapsedSeconds = Math.max(0, (now - anchor.at) / 1000);
  return { value: total + perSecond * elapsedSeconds, places };
}

export function TotalValue({
  value,
  amount,
  digits,
  currency,
  fontSize,
  isHidden,
}: {
  value: number;
  // What is written in place of the value: the total cut at its cents, when
  // the digits after them follow
  amount?: string;
  // The digits after the cents, on the total's baseline
  digits?: ReactNode;
  currency: string;
  fontSize: number;
  isHidden: boolean;
}) {
  const textProps = {
    numberOfLines: 1,
    fontSize,
    lineHeight: fontSize,
    fontWeight: 500,
    fontVariant: PROPORTIONAL_NUMS,
  } as const;
  // The currency sign's side bearing, so the glyph, not its box, lines up
  // with the label and the buttons. A shift rather than a margin, which would
  // take the width from the number and cut it short
  const x = -Math.round(fontSize / 21);
  if (isHidden) {
    // Asterisks sit at the cap height; lowered, they center on the line the
    // digits fill
    return (
      <SizableText
        {...textProps}
        x={x}
        y={Math.round(fontSize * ASTERISK_DROP)}
      >
        ****
      </SizableText>
    );
  }
  const formatted = (
    <NumberSizeableTextWrapper
      {...textProps}
      splitDecimal
      formatter="value"
      formatterOptions={{ currency }}
      // Beside the digits the amount is the part that gives way
      {...(digits ? { flexShrink: 1, minWidth: 0 } : undefined)}
    >
      {amount ?? String(Math.abs(value))}
    </NumberSizeableTextWrapper>
  );
  // The value formatter writes a negative as "< 0.01", so the sign goes in
  // front of the formatted amount
  return value < 0 || digits ? (
    <XStack ai="baseline" minWidth={0} x={x}>
      {value < 0 ? <SizableText {...textProps}>-</SizableText> : null}
      {formatted}
      {digits}
    </XStack>
  ) : (
    <YStack minWidth={0} x={x}>
      {formatted}
    </YStack>
  );
}

/**
 * The net worth as it grows: the total, and after its cents the smaller
 * digits that are seen to move. It holds the clock, so the hero around it is
 * not drawn again at every tick
 */
export function TickingTotalValue({
  total,
  change24h,
  isRunning,
  currency,
  fontSize,
  isHidden,
  isStatic,
  hidesDigits,
  onDigitsWidth,
}: {
  total: number;
  change24h: number;
  isRunning: boolean;
  currency: string;
  fontSize: number;
  isHidden: boolean;
  // The copy that is only measured: no motion
  isStatic?: boolean;
  // No room for them at any size
  hidesDigits?: boolean;
  // How wide the digits are at this size; none, nothing
  onDigitsWidth?: (width: number) => void;
}) {
  const { value, places } = useTickingTotal(total, change24h, isRunning);
  const { cents, digits } =
    hidesDigits || isHidden
      ? { cents: '', digits: '' }
      : splitTickingValue(value, places);
  const hasDigits = digits.length > 0;
  useEffect(() => {
    if (!hasDigits) {
      onDigitsWidth?.(0);
    }
  }, [hasDigits, onDigitsWidth]);
  const handleDigitsLayout = useCallback(
    (event: LayoutChangeEvent) =>
      onDigitsWidth?.(Math.ceil(event.nativeEvent.layout.width)),
    [onDigitsWidth],
  );
  return (
    <TotalValue
      value={value}
      amount={hasDigits ? cents : undefined}
      digits={
        hasDigits ? (
          <EarnTickingDigits
            digits={digits}
            fontSize={fontSize}
            isStatic={isStatic}
            onLayout={onDigitsWidth ? handleDigitsLayout : undefined}
          />
        ) : undefined
      }
      currency={currency}
      fontSize={fontSize}
      isHidden={isHidden}
    />
  );
}
