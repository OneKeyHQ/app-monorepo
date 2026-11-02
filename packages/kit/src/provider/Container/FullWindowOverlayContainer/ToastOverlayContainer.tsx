import type { PropsWithChildren } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IOverlayAnimation } from '@onekeyfe/react-native-native-overlay';

// The host stays up for the app's lifetime; the toasts animate themselves.
const HOST_ANIMATION: IOverlayAnimation = { enter: { type: 'none' } };
const GESTURE_ROOT_STYLE = { flex: 1 } as const;

/**
 * Hosts the toasters in the native `toast` overlay level, above dialogs,
 * sheets and the hardware stage and below the lock screen, on every
 * platform. Touches outside the toasts pass through.
 */
export function ToastOverlayContainer({ children }: PropsWithChildren) {
  return (
    <OverlayView
      visible
      level="toast"
      presentation="fullscreen"
      animation={HOST_ANIMATION}
      blocking={false}
      backdrop={false}
      dismissOnBackPress={false}
      testID="toast-overlay-host"
    >
      {platformEnv.isNativeAndroid ? (
        <GestureHandlerRootView
          style={GESTURE_ROOT_STYLE}
          pointerEvents="box-none"
        >
          {children}
        </GestureHandlerRootView>
      ) : (
        children
      )}
    </OverlayView>
  );
}
