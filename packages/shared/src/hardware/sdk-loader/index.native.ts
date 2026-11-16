import type { CoreApi, UsbDeviceIdentity } from '@onekeyfe/hd-core';

export const probeUsbDeviceIdentities = (_params: {
  commType: UsbDeviceIdentity['commType'];
}): Promise<UsbDeviceIdentity[]> => Promise.resolve([]);

export const importHardwareSDK = async () =>
  (await import('@onekeyfe/hd-ble-sdk')).default as unknown as Promise<CoreApi>;

export const importHardwareSDKLowLevel = async () => Promise.resolve(undefined);

/**
 * Android automatic USB+BLE needs the hd-ble-sdk release from
 * hardware-js-sdk#997 (env 'react-native-combined'). That release is the
 * first to export `setPriorityMode`, so its presence is the capability check.
 * The pinned 1.2.10 lacks it and ignores env, so auto USB stays off there.
 */
export const isAndroidCombinedTransportSupported =
  async (): Promise<boolean> => {
    try {
      const sdk = (await import('@onekeyfe/hd-ble-sdk')) as unknown as {
        setPriorityMode?: unknown;
        default?: { setPriorityMode?: unknown };
      };
      return (
        typeof sdk.setPriorityMode === 'function' ||
        typeof sdk.default?.setPriorityMode === 'function'
      );
    } catch {
      return false;
    }
  };
