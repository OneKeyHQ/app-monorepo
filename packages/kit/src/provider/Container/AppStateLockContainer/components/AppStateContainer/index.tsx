import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';

import { ImperativeOverlayMountHost } from '@onekeyhq/components/src/shared/imperativeOverlayMount';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IOverlayAnimation } from '@onekeyfe/react-native-native-overlay';

// The lock screen fades itself (AnimatePresence in AppStateLockContainer);
// the host appears and leaves with it.
const HOST_ANIMATION: IOverlayAnimation = {
  enter: { type: 'none' },
  exit: { type: 'none' },
};

/**
 * Hosts the lock screen in the native `lock` overlay level: above every
 * dialog, sheet, hardware stage, password prompt and toast, which stay open
 * underneath instead of being closed. Dialogs opened from the lock screen
 * use their own overlay level above it.
 */
export function AppStateContainer({ children }: PropsWithChildren) {
  // The WalletConnect modal is its own Android window above the app and its
  // overlays; close it when the lock screen appears.
  useEffect(() => {
    if (platformEnv.isNativeAndroid) {
      appEventBus.emit(EAppEventBusNames.WalletConnectCloseModal, undefined);
    }
  }, []);
  return (
    <OverlayView
      visible
      level="lock"
      presentation="fullscreen"
      animation={HOST_ANIMATION}
      blocking
      backdrop={false}
      dismissOnBackPress={false}
      testID="app-state-lock-overlay"
    >
      {children}
      <ImperativeOverlayMountHost target="lock" />
    </OverlayView>
  );
}
