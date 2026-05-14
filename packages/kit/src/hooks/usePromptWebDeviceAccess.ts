import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { getWebUsbDeviceFilters } from './usePromptWebDeviceAccessUtils';

async function ensureLinuxWebUsbPermissions() {
  if (!platformEnv.isDesktopLinux || platformEnv.isDesktopLinuxSnap) {
    return;
  }

  try {
    const result =
      await globalThis.desktopApiProxy?.system?.installOneKeyUdevRules?.();
    if (result?.installed) {
      console.log('OneKey udev rules ready:', result);
    } else if (result) {
      console.warn('OneKey udev rules were not installed:', result);
    }
  } catch (error) {
    console.warn('Failed to install OneKey udev rules:', error);
  }
}

export function usePromptWebDeviceAccess() {
  /**
   * web-usb and web-ble requestDevice function must be called in the ui thread
   * so we need to call it in the kit layer
   */
  const promptWebUsbDeviceAccess = useCallback(
    async (vendor?: EHardwareVendor) => {
      try {
        await ensureLinuxWebUsbPermissions();
        const device = await navigator.usb.requestDevice({
          filters: getWebUsbDeviceFilters(vendor),
        });
        console.log('USB device permission granted:', device);
        return device;
      } catch (error) {
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
