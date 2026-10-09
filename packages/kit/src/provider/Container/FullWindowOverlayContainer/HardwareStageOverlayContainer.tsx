import type { PropsWithChildren } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';

import type { IOverlayAnimation } from '@onekeyfe/react-native-native-overlay';

// The host stays up for the app's lifetime; the stage animates itself.
const HOST_ANIMATION: IOverlayAnimation = { enter: { type: 'none' } };

/**
 * Hosts the hardware stage (MorphOverlay / DeviceStage) in the native
 * `hardware` overlay level: above every dialog and sheet, below password
 * prompts, toasts and the lock screen, on every platform. The host lets
 * touches through; the stage's own wall blocks the app while it is up.
 */
export function HardwareStageOverlayContainer({ children }: PropsWithChildren) {
  return (
    <OverlayView
      visible
      level="hardware"
      presentation="fullscreen"
      animation={HOST_ANIMATION}
      blocking={false}
      backdrop={false}
      dismissOnBackPress={false}
      testID="hardware-stage-overlay-host"
    >
      {children}
    </OverlayView>
  );
}
