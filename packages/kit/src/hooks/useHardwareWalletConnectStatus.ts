import { useEffect, useMemo, useState } from 'react';

import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * Check if a USB device is a OneKey hardware wallet
 */
function isOneKeyDevice(device: USBDevice): boolean {
  return (
    ONEKEY_WEBUSB_FILTER?.some(
      (filter) =>
        device.vendorId === filter.vendorId &&
        device.productId === filter.productId,
    ) ?? false
  );
}

/**
 * Hook to detect connected hardware wallets via WebUSB
 *
 * Features:
 * - Real-time detection using WebUSB connect/disconnect events
 * - Returns a Set of connected device IDs (USB serial numbers)
 * - Use connectedDevices.has(deviceId) to check if a specific wallet is connected
 */
export function useHardwareWalletConnectStatus() {
  // State to trigger re-fetch when USB events occur
  const [eventTrigger, setEventTrigger] = useState(0);

  const {
    result: connectedDevices,
    isLoading,
    run: refresh,
  } = usePromiseResult(
    async () => {
      // Only run on platforms that support WebUSB
      if (!platformEnv.isSupportWebUSB) {
        return new Set<string>();
      }

      const usb = globalThis?.navigator?.usb;
      if (!usb || typeof usb.getDevices !== 'function') {
        return new Set<string>();
      }

      // Get connected USB devices
      const devices = await usb.getDevices();

      // Filter OneKey devices and collect their serial numbers
      const deviceIds = new Set<string>();
      for (const device of devices) {
        if (isOneKeyDevice(device) && device.serialNumber) {
          deviceIds.add(device.serialNumber);
        }
      }

      return deviceIds;
    },
    // eventTrigger is used to re-fetch when USB connect/disconnect events occur
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventTrigger],
    {
      initResult: new Set<string>(),
      checkIsFocused: false,
    },
  );

  // Set up WebUSB event listeners for real-time connection detection
  useEffect(() => {
    if (!platformEnv.isSupportWebUSB) {
      return;
    }

    const usb = globalThis?.navigator?.usb;
    if (!usb) {
      return;
    }

    const handleConnect = (event: USBConnectionEvent) => {
      if (isOneKeyDevice(event.device)) {
        setEventTrigger((prev) => prev + 1);
      }
    };

    const handleDisconnect = (event: USBConnectionEvent) => {
      if (isOneKeyDevice(event.device)) {
        setEventTrigger((prev) => prev + 1);
      }
    };

    usb.addEventListener('connect', handleConnect);
    usb.addEventListener('disconnect', handleDisconnect);

    return () => {
      usb.removeEventListener('connect', handleConnect);
      usb.removeEventListener('disconnect', handleDisconnect);
    };
  }, []);

  return useMemo(
    () => ({
      /** Set of connected device IDs (USB serial numbers) */
      connectedDevices: connectedDevices ?? new Set<string>(),
      isLoading,
      /** Manually refresh connection status */
      refresh,
    }),
    [connectedDevices, isLoading, refresh],
  );
}
