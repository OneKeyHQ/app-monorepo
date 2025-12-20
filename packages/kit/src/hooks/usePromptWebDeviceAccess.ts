import { useCallback, useMemo } from 'react';

import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function usePromptWebDeviceAccess() {
  /**
   * web-usb and web-ble requestDevice function must be called in the ui thread
   * so we need to call it in the kit layer
   */
  const promptWebUsbDeviceAccess = useCallback(async () => {
    try {
      // Request USB device access with OneKey filters
      const device = await navigator.usb.requestDevice({
        filters: ONEKEY_WEBUSB_FILTER,
      });
      console.log('USB device permission granted:', device);
      return device;
    } catch (error) {
      console.error('Failed to request USB device permission:', error);
      throw error;
    }
  }, []);

  return { promptWebUsbDeviceAccess };
}

export function useToPromptWebDeviceAccessPage() {
  return useMemo(
    () => async () => {
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel ||
        platformEnv.isExtensionUiStandaloneWindow
      ) {
        await backgroundApiProxy.serviceApp.openExtensionExpandTab({
          routes: 'permission/web-device',
        });
      }
    },
    [],
  );
}
