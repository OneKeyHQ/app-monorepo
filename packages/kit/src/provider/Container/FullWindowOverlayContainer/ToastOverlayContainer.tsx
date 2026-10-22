import type { PropsWithChildren } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';

import type { IOverlayAnimation } from '@onekeyfe/react-native-native-overlay';

// The host stays up for the app's lifetime; the toasts animate themselves.
const HOST_ANIMATION: IOverlayAnimation = { enter: { type: 'none' } };

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
      {children}
    </OverlayView>
  );
}
