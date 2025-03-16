import { useCallback } from 'react';

import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';

export function usePromptWebDeviceAccess() {
  const promptWebUsbDeviceAccess = useCallback(async () => {
    try {
      // Request USB device access with OneKey filters
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const device = await navigator.usb.requestDevice({
        filters: ONEKEY_WEBUSB_FILTER,
      });
      console.log('USB device permission granted:', device);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return device;
    } catch (error) {
      console.error('Failed to request USB device permission:', error);
      throw error;
    }
  }, []);

  return { promptWebUsbDeviceAccess };
}
