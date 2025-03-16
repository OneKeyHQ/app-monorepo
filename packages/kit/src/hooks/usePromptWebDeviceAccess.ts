import { useCallback } from 'react';

import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';

export function usePromptWebDeviceAccess() {
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
