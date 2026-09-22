import { useSyncExternalStore } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// The patched Tamagui native media driver (patches/@tamagui+react-native-media-driver+*.patch) clamps
// tablets to phone breakpoints because tab pages live in a half-width
// split-view pane. Full-screen surfaces such as onboarding v2 are not inside a
// pane, so they hold real window-width breakpoints for their lifetime.
// Ref-counted so overlapping holders never release early.
let holders = 0;
const heldListeners = new Set<() => void>();

function syncNativeMedia(useRealWidth: boolean) {
  const control =
    globalThis.$$onekeyNativeMedia ??
    (globalThis.$$onekeyNativeMedia = { useRealWidth: false });
  if (control.useRealWidth === useRealWidth) {
    return;
  }
  control.useRealWidth = useRealWidth;
  control.refresh?.();
}

function notifyHeldListeners() {
  heldListeners.forEach((listener) => listener());
}

function subscribeHeldState(listener: () => void) {
  heldListeners.add(listener);
  return () => {
    heldListeners.delete(listener);
  };
}

function getHeldState() {
  return holders > 0;
}

export function acquireNativeTabletRealWidthMedia() {
  if (!platformEnv.isNativeIOSPad) {
    return;
  }
  holders += 1;
  if (holders === 1) {
    syncNativeMedia(true);
    notifyHeldListeners();
  }
}

export function releaseNativeTabletRealWidthMedia() {
  if (!platformEnv.isNativeIOSPad) {
    return;
  }
  const wasHeld = holders > 0;
  holders = Math.max(0, holders - 1);
  if (holders === 0) {
    syncNativeMedia(false);
    if (wasHeld) {
      notifyHeldListeners();
    }
  }
}

// Holders acquire from a layout effect, so subscribers re-render in the same
// commit. Split-view chrome relies on this to hide before the first frame
// instead of waiting for asynchronous app state.
export function useIsNativeTabletRealWidthMediaHeld() {
  return useSyncExternalStore(subscribeHeldState, getHeldState);
}
