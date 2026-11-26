import { useSyncExternalStore } from 'react';

import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';

import type { IInterfaceOrientation } from './types';

export type { IInterfaceOrientation } from './types';

// JS can reach users over the air before a native shell that has these
// methods, so treat their absence as an unknown orientation.
function isSupported() {
  return typeof ReactNativeDeviceUtils.getInterfaceOrientation === 'function';
}

function subscribe(onChange: () => void) {
  if (!isSupported()) {
    return () => {};
  }
  const listenerId =
    ReactNativeDeviceUtils.addInterfaceOrientationChangedListener(onChange);
  return () => {
    ReactNativeDeviceUtils.removeInterfaceOrientationChangedListener(
      listenerId,
    );
  };
}

function getSnapshot(): IInterfaceOrientation {
  return isSupported()
    ? ReactNativeDeviceUtils.getInterfaceOrientation()
    : 'unknown';
}

// Orientation of the app's window scene. It follows rotations that a
// presented screen forces while the rest of the app keeps portrait, and it is
// read again on every render, so it is current in the render that sees the
// rotated layout.
export function useInterfaceOrientation(): IInterfaceOrientation {
  return useSyncExternalStore(subscribe, getSnapshot);
}
