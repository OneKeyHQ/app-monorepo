import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { getWebUsbDeviceFilters } from './usePromptWebDeviceAccessUtils';

function serializeWebDeviceAccessError(error: unknown) {
  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;
    return {
      name: typeof errorRecord.name === 'string' ? errorRecord.name : undefined,
      message:
        typeof errorRecord.message === 'string'
          ? errorRecord.message
          : undefined,
      error: String(error),
    };
  }
  return {
    error: String(error),
  };
}

export function usePromptWebDeviceAccess() {
  /**
   * web-usb and web-ble requestDevice function must be called in the ui thread
   * so we need to call it in the kit layer
   */
  const promptWebUsbDeviceAccess = useCallback(
    async (vendor?: EHardwareVendor) => {
      try {
        const device = await navigator.usb.requestDevice({
          filters: getWebUsbDeviceFilters(vendor),
        });
        console.log('USB device permission granted:', device);
        return device;
      } catch (error) {
        if (platformEnv.isDesktop) {
          try {
            // Installing udev rules here prepares the next browser prompt; the
            // current requestDevice() rejection still needs to propagate.
            await backgroundApiProxy.serviceHardware.handleLinuxWebUsbAccessDeniedError(
              {
                error: serializeWebDeviceAccessError(error),
              },
            );
          } catch (handleError) {
            console.error(
              'Failed to handle Linux WebUSB access error:',
              handleError,
            );
          }
        }
        console.error('Failed to request USB device permission:', error);
        throw error;
      }
    },
    [],
  );

  const promptHidDeviceAccess = useCallback(async () => {
    const filters: HIDDeviceFilter[] = [{ vendorId: 0x2c_97 }]; // Ledger vendor ID
    const [device] = await navigator.hid.requestDevice({ filters });
    return device;
  }, []);

  return { promptWebUsbDeviceAccess, promptHidDeviceAccess };
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
