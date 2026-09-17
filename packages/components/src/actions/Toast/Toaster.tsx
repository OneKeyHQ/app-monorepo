import { memo, useMemo } from 'react';

import { createPortal } from 'react-dom';
import { Toaster as WebToaster } from 'sonner';

import { TOAST_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import { useMedia, useThemeName } from '../../hooks/useStyle';
import { Stack } from '../../primitives';

import {
  TOAST_SHIFT_MS,
  TOAST_UNDER_OBSTRUCTION_GAP,
  useToastTopObstruction,
} from './topObstruction';

const toasterStyle = {
  zIndex: TOAST_Z_INDEX,
  transition: `top ${TOAST_SHIFT_MS}ms ease`,
} as const;

function Toaster() {
  const media = useMedia();
  const themeName = useThemeName();
  // A phone-class window lands its toasts at the top, where the hardware
  // stage hangs: while it is up they rest under its bottom edge instead
  // of covering it (see topObstruction) — a toast already on show rides
  // down with the transition above. An inline `top` on purpose: sonner
  // pins a narrow window's toaster with a fixed rule that ignores its own
  // `offset`. The wide window's toasts live in the bottom corner and never
  // meet the stage: they read a constant, so no publish re-renders them.
  const obstruction = useToastTopObstruction(media.md);
  const top =
    obstruction > 0 ? obstruction + TOAST_UNDER_OBSTRUCTION_GAP : undefined;
  const style = useMemo(() => ({ ...toasterStyle, top }), [top]);

  return (
    <Stack
      testID="onekey-toast-messages"
      zIndex={TOAST_Z_INDEX}
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

function BodyPortal() {
  return createPortal(<Toaster />, document.body);
}

export default memo(BodyPortal);
