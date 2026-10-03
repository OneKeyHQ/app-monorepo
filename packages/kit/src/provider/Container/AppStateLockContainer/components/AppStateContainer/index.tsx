import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';

import { Portal } from '@onekeyhq/components';
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
 * underneath instead of being closed. Its dialog portal lives in the same
 * host, so dialogs opened from the lock screen (forgot passcode, export
 * logs) render in the `lock` level above it — and, on web, inside the same
 * `document.body` child that the lock screen keeps interactive (OK-62416).
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
      <Portal.Container
        name={Portal.Constant.APP_STATE_LOCK_CONTAINER_OVERLAY}
      />
    </OverlayView>
  );
}
