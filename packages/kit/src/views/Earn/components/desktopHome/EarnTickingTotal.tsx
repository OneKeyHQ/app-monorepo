import { useEffect, useState } from 'react';

import {
  PROPORTIONAL_NUMS,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';

const SECONDS_PER_DAY = 24 * 60 * 60;
const MIN_TICK_MS = 1000;
const MAX_TICK_MS = 60_000;
// How far a hidden amount's asterisks drop, as a share of their size
export const ASTERISK_DROP = 0.16;

// The total keeps moving between refreshes at the estimated daily change's
// per-second rate. It shows cents only, so it re-renders about when the next
// cent accrues, between once a second and once a minute. It stands still while
// hidden, loading or off screen
function useTickingTotal(total: number, change24h: number, isRunning: boolean) {
  const perSecond = change24h > 0 ? change24h / SECONDS_PER_DAY : 0;
  const [anchor, setAnchor] = useState(() => ({ total, at: Date.now() }));
  const [now, setNow] = useState(() => Date.now());
  if (anchor.total !== total) {
    setAnchor({ total, at: Date.now() });
  }
  const tickMs =
    perSecond > 0 && isRunning
      ? Math.min(MAX_TICK_MS, Math.max(MIN_TICK_MS, 10 / perSecond))
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
  return total + perSecond * elapsedSeconds;
}

export function TotalValue({
  value,
  currency,
  fontSize,
  isHidden,
}: {
  value: number;
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
  const amount = (
    <NumberSizeableTextWrapper
      {...textProps}
      splitDecimal
      formatter="value"
      formatterOptions={{ currency }}
    >
      {String(Math.abs(value))}
    </NumberSizeableTextWrapper>
  );
  // The value formatter writes a negative as "< 0.01", so the sign goes in
  // front of the formatted amount
  return value < 0 ? (
    <XStack ai="baseline" minWidth={0} x={x}>
      <SizableText {...textProps}>-</SizableText>
      {amount}
    </XStack>
  ) : (
    <YStack minWidth={0} x={x}>
      {amount}
    </YStack>
  );
}

/**
 * The net worth as it grows, to its cents (the digits after them stood here
 * for a day and went on 11-12). It holds the clock, so what is around it is
 * not drawn again at every tick
 */
export function TickingTotalValue({
  total,
  change24h,
  isRunning,
  currency,
  fontSize,
  isHidden,
}: {
  total: number;
  change24h: number;
  isRunning: boolean;
  currency: string;
  fontSize: number;
  isHidden: boolean;
}) {
  const value = useTickingTotal(total, change24h, isRunning);
  return (
    <TotalValue
      value={value}
      currency={currency}
      fontSize={fontSize}
      isHidden={isHidden}
    />
  );
}
