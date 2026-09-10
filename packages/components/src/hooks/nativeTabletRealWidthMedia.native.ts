import platformEnv from '@onekeyhq/shared/src/platformEnv';

// The patched Tamagui native media driver (patches/@tamagui+web+*.patch) clamps
// tablets to phone breakpoints because tab pages live in a half-width
// split-view pane. Full-screen surfaces such as onboarding v2 are not inside a
// pane, so they hold real window-width breakpoints for their lifetime.
// Ref-counted so overlapping holders never release early.
let holders = 0;

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

export function acquireNativeTabletRealWidthMedia() {
  if (!platformEnv.isNativeIOSPad) {
    return;
  }
  holders += 1;
  if (holders === 1) {
    syncNativeMedia(true);
  }
}

export function releaseNativeTabletRealWidthMedia() {
  if (!platformEnv.isNativeIOSPad) {
    return;
  }
  holders = Math.max(0, holders - 1);
  if (holders === 0) {
    syncNativeMedia(false);
  }
}
