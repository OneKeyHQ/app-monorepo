import { OneKeyLocalError } from '../../errors';

import type { IConnector, IHardwareBridge } from '@onekeyfe/hwk-adapter-core';

// The offscreen document owns WebUSB handles; the service worker only uses RPC.
export const createKeystoneUsbConnector = async (options?: {
  bridge?: IHardwareBridge;
}): Promise<IConnector> => {
  if (!options?.bridge) {
    throw new OneKeyLocalError(
      'createKeystoneUsbConnector(ext): bridge is required',
    );
  }
  const { createBridgedConnector } = await import('@onekeyfe/hwk-adapter-core');
  return createBridgedConnector('keystone', 'usb', options.bridge);
};
