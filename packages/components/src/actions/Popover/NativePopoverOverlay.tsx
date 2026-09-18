import { type PropsWithChildren, useRef } from 'react';

import { Portal } from '../../hocs';
import { OverlayContainer } from '../../layouts/OverlayContainer';

let nativePopoverOverlayRaiseToken = 0;

function nextNativePopoverOverlayRaiseToken() {
  nativePopoverOverlayRaiseToken += 1;
  return nativePopoverOverlayRaiseToken;
}

export function NativePopoverOverlay({
  children,
  active,
}: PropsWithChildren<{ active: boolean }>) {
  const raiseTokenRef = useRef(0);
  const wasActiveRef = useRef(false);
  // iOS stacks FullWindowOverlay containers in the order they were added, so a
  // sheet portaled into the app-start overlay sits under a later modal page
  // (Bulk Export History, OK-63722). Dialogs already wrap in a fresh
  // OverlayContainer; bump the token in this same commit so a recycled native
  // view is re-fronted the way the hardware stage is (OK-62422).
  if (active && !wasActiveRef.current) {
    raiseTokenRef.current = nextNativePopoverOverlayRaiseToken();
  }
  wasActiveRef.current = active;

  return (
    <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
      <OverlayContainer bringToFrontToken={raiseTokenRef.current}>
        {children}
      </OverlayContainer>
    </Portal.Body>
  );
}
