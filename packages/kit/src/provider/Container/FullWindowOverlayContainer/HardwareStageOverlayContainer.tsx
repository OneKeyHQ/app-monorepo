import { useCallback } from 'react';
import type { PropsWithChildren } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';

import { useDeviceStageAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IOverlayAnimation } from '@onekeyfe/react-native-native-overlay';

// The host stays up for the app's lifetime; the stage animates itself.
const HOST_ANIMATION: IOverlayAnimation = { enter: { type: 'none' } };

let stageBackHandler: (() => boolean) | undefined;

// The stage driver lives in a sibling tree outside this native overlay host.
export function registerHardwareStageBackHandler(handler: () => boolean) {
  stageBackHandler = handler;
  return () => {
    if (stageBackHandler === handler) {
      stageBackHandler = undefined;
    }
  };
}

/**
 * Hosts the hardware stage (MorphOverlay / DeviceStage) in the native
 * `hardware` overlay level: above every dialog and sheet, below password
 * prompts, toasts and the lock screen, on every platform. The host lets
 * touches through; the stage's own wall blocks the app while it is up.
 */
export function HardwareStageOverlayContainer({ children }: PropsWithChildren) {
  const [stage] = useDeviceStageAtom();
  const interceptAndroidBack =
    platformEnv.isNativeAndroid && Boolean(stage && stage.step !== 'off');
  const handleRequestDismiss = useCallback(() => {
    if (interceptAndroidBack) {
      // Keep intercepting while the driver's lazy callback is not ready.
      stageBackHandler?.();
    }
  }, [interceptAndroidBack]);

  return (
    <OverlayView
      visible
      level="hardware"
      presentation="fullscreen"
      animation={HOST_ANIMATION}
      blocking={false}
      backdrop={false}
      dismissOnBackPress={interceptAndroidBack}
      onRequestDismiss={handleRequestDismiss}
      testID="hardware-stage-overlay-host"
    >
      {children}
    </OverlayView>
  );
}
