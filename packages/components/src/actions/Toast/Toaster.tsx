import { memo, useMemo } from 'react';

import { useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Toaster as WebToaster } from 'sonner';

import { useMedia, useThemeName } from '../../hooks/useStyle';
import { Stack } from '../../primitives';

import {
  TOAST_ROOM,
  TOAST_SHIFT_MS,
  toastShiftUnderObstruction,
  useToastTopObstruction,
} from './topObstruction';

// The toaster lives in the native overlay `toast` level, which owns the
// stacking.
const TOAST_RIDE_STYLE = {
  transition: `top ${TOAST_SHIFT_MS}ms ease`,
} as const;

function Toaster() {
  const media = useMedia();
  const themeName = useThemeName();
  // A phone-class window lands its toasts at the top, where the hardware
  // stage hangs: while it is up they rest under its bottom edge instead
  // of covering it (see topObstruction) — a toast already on show rides
  // down on the transition, which reduced motion drops — and never past
  // the window's own bottom: under a card that leaves no room the toast
  // overlaps the card's foot instead of leaving the screen. An inline
  // `top` on purpose: sonner pins a narrow window's toaster with a fixed
  // rule that ignores its own `offset`. The wide window's toasts live in
  // the bottom corner and never meet the stage: they read a constant, so
  // no publish re-renders them.
  const obstruction = useToastTopObstruction(media.md);
  const { height: windowHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const top =
    toastShiftUnderObstruction(obstruction, 0, windowHeight - TOAST_ROOM) ||
    undefined;
  const style = useMemo(
    () => ({ ...(reducedMotion ? undefined : TOAST_RIDE_STYLE), top }),
    [reducedMotion, top],
  );

  return (
    <Stack
      testID="onekey-toast-messages"
      // https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events#bounding-box
      // allow svg button elements to be clickable
      pointerEvents={'bounding-box' as any}
    >
      <WebToaster
        closeButton
        style={style}
        visibleToasts={3}
        position={media.md ? 'top-center' : 'bottom-right'}
        theme={themeName}
      />
    </Stack>
  );
}

// Rendered inline: the app hosts it in the native overlay `toast` layer.
export default memo(Toaster);
