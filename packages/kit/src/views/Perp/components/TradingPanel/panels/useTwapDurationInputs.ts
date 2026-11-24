import { useEffect, useRef, useState } from 'react';

import { TWAP_MAX_DURATION_MINUTES } from '@onekeyhq/shared/src/utils/hyperliquidTwapUtils';

export type ITwapDurationInputField = 'hours' | 'minutes';

export function clampTwapDurationMinutes(minutes: number) {
  if (Number.isNaN(minutes) || minutes <= 0) {
    return 0;
  }
  if (!Number.isFinite(minutes)) {
    return TWAP_MAX_DURATION_MINUTES;
  }
  return Math.min(minutes, TWAP_MAX_DURATION_MINUTES);
}

export function splitTwapDurationMinutes(minutes: number) {
  const clampedMinutes = clampTwapDurationMinutes(minutes);
  return {
    hours: Math.floor(clampedMinutes / 60),
    minutes: clampedMinutes % 60,
  };
}

/**
 * The hours and minutes a TWAP duration is typed as. They follow the order's
 * duration, except while one of them has the focus: a duration being typed
 * is not rewritten under the cursor. An order of another token is none being
 * typed, so the fields take its duration whichever has the focus, e.g. as a
 * failed switch puts the page back on its token with the order it had there.
 * Otherwise the fields would go on showing a duration the order does not
 * have.
 */
export function useTwapDurationInputs({
  durationMinutes,
  isTwapMode,
  orderKey,
}: {
  /** The order's duration, as the order form holds it. */
  durationMinutes: string | undefined;
  isTwapMode: boolean;
  /** Names the token the order is for. */
  orderKey: string;
}) {
  const [hoursInput, setHoursInput] = useState('');
  const [minutesInput, setMinutesInput] = useState('');
  const focusedFieldRef = useRef<ITwapDurationInputField | null>(null);
  const syncedOrderKey = useRef(orderKey);

  useEffect(() => {
    if (!isTwapMode) {
      return;
    }
    const isOtherOrder = syncedOrderKey.current !== orderKey;
    syncedOrderKey.current = orderKey;
    if (focusedFieldRef.current && !isOtherOrder) {
      return;
    }
    const rawDuration = durationMinutes ?? '';
    if (!rawDuration) {
      setHoursInput('');
      setMinutesInput('');
      return;
    }
    const totalMinutes = Number(rawDuration);
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
      return;
    }
    const durationParts = splitTwapDurationMinutes(totalMinutes);
    const nextHours = String(durationParts.hours);
    const nextMinutes = String(durationParts.minutes);
    setHoursInput((prev) => (prev === nextHours ? prev : nextHours));
    setMinutesInput((prev) => (prev === nextMinutes ? prev : nextMinutes));
  }, [durationMinutes, isTwapMode, orderKey]);

  return {
    hoursInput,
    minutesInput,
    setHoursInput,
    setMinutesInput,
    focusedFieldRef,
  };
}
