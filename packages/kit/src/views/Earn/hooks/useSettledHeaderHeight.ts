import { useEffect, useRef, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// OK-59958: on iOS 26 the nav bar is transparent and pages offset their body by
// useHeaderHeight(). That hook reports react-navigation's synchronous estimate
// for the first renders (97.67 on a Dynamic Island device) and the natively
// measured height (113) only once the header lays out, so a body painted
// straight away drops by the 15.33pt difference a beat later.
export const HEADER_HEIGHT_SETTLE_MS = 64;

// Waiting for quiet is only safe if it is bounded. On a real device the height
// kept moving for ~1s, and holding the body for all of it read as a blank page.
// Measured from mount, not from the last change: past this point reveal
// whatever we have, because a settle we cannot observe is not worth a second of
// white.
const HEADER_HEIGHT_MAX_HOLD_MS = 250;

// The measured height is a property of the device, not of the screen, so the
// first page that settles it can hand the value to every later mount. Without
// this, re-entering a page gated again from scratch and blanked the body a
// second time even though the answer was already known.
let deviceSettledHeaderHeight: number | undefined;

export function resetDeviceSettledHeaderHeightForTest() {
  deviceSettledHeaderHeight = undefined;
}

/**
 * Resolves the top inset a page body should be laid out against, plus whether
 * that value can be trusted yet.
 *
 * `isSettled` is false only while the very first measurement of the app session
 * is still moving; callers hide their body for that window so the padding never
 * changes under visible content. Later mounts reuse the remembered height and
 * are settled from their first render, so re-entry never blanks.
 *
 * Off-target platforms have a constant 0 inset — they settle immediately and
 * must never hide.
 */
export function useSettledHeaderHeight(
  headerHeight: number,
  {
    enabled = platformEnv.isNativeIOS26Plus,
    settleMs = HEADER_HEIGHT_SETTLE_MS,
    maxHoldMs = HEADER_HEIGHT_MAX_HOLD_MS,
  }: { enabled?: boolean; settleMs?: number; maxHoldMs?: number } = {},
): { paddingTop: number; isSettled: boolean } {
  const [settledHeight, setSettledHeight] = useState<number | undefined>(() =>
    enabled ? deviceSettledHeaderHeight : 0,
  );
  const holdDeadlineRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      setSettledHeight(0);
      return undefined;
    }

    if (settledHeight === headerHeight) {
      return undefined;
    }

    const accept = () => {
      deviceSettledHeaderHeight = headerHeight;
      setSettledHeight(headerHeight);
    };

    // Height already known for this device: adopt changes (rotation, a
    // genuinely late measurement) through the same quiet window, but never go
    // back to hidden. Debouncing matters on re-entry too — the first renders
    // report the estimate again, and taking it immediately would replace a good
    // remembered height with a transient one.
    if (settledHeight !== undefined) {
      const timer = setTimeout(accept, settleMs);
      return () => clearTimeout(timer);
    }

    if (holdDeadlineRef.current === undefined) {
      holdDeadlineRef.current = Date.now() + maxHoldMs;
    }
    const remainingHold = Math.max(0, holdDeadlineRef.current - Date.now());
    const timer = setTimeout(accept, Math.min(settleMs, remainingHold));
    return () => clearTimeout(timer);
  }, [enabled, headerHeight, settleMs, maxHoldMs, settledHeight]);

  return {
    // Before anything is known the live estimate is the best guess, and the
    // body is hidden anyway.
    paddingTop: settledHeight ?? headerHeight,
    isSettled: settledHeight !== undefined,
  };
}
