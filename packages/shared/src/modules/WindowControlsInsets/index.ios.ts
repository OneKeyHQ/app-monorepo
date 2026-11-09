import { useEffect, useState } from 'react';

import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';

import { ZERO_WINDOW_CONTROLS_INSETS } from './types';

import type { IWindowControlsInsets } from './types';

export type { IWindowControlsInsets } from './types';

// JS can reach users over the air before a native shell that has these
// methods, so treat their absence as "no window controls".
const isSupported =
  typeof ReactNativeDeviceUtils.getWindowControlsInsets === 'function';

function readInsets(): IWindowControlsInsets {
  return isSupported
    ? ReactNativeDeviceUtils.getWindowControlsInsets()
    : ZERO_WINDOW_CONTROLS_INSETS;
}

function isSameInsets(a: IWindowControlsInsets, b: IWindowControlsInsets) {
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.bottom === b.bottom &&
    a.right === b.right
  );
}

// Window controls insets of the main window, such as the iPadOS window
// controls in the top-leading corner of a resizable window.
export function useWindowControlsInsets(): IWindowControlsInsets {
  const [insets, setInsets] = useState(readInsets);
  useEffect(() => {
    if (!isSupported) {
      return;
    }
    const update = (next: IWindowControlsInsets) => {
      setInsets((prev) => (isSameInsets(prev, next) ? prev : next));
    };
    const listenerId =
      ReactNativeDeviceUtils.addWindowControlsInsetsChangedListener(update);
    // The first native measurement can land before the listener is added.
    update(readInsets());
    return () => {
      ReactNativeDeviceUtils.removeWindowControlsInsetsChangedListener(
        listenerId,
      );
    };
  }, []);
  return insets;
}

// Extra leading offset for content that already keeps `contentPadding` from
// the window edge. The insets also cover the rounded window corners (about
// 9pt even in full screen), which existing padding already clears.
export function useWindowControlsLeadingOffset(contentPadding: number) {
  const { left } = useWindowControlsInsets();
  return Math.max(0, left - contentPadding);
}
