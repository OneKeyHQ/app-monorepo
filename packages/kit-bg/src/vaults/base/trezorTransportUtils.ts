import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice } from '../../dbs/local/types';
import type { IThirdPartyHardwareAdapter } from '../../services/ServiceHardware/adapters/types';
import type { Response } from '@onekeyfe/hwk-adapter-core';

export function isTrezorBleSupportedDevice(dbDevice: IDBDevice): boolean {
  return thirdPartyDeviceUtils.isTrezorBleSupportedDevice(dbDevice);
}

export async function getTrezorAdapterFromBackgroundApi(
  backgroundApi: IBackgroundApi,
): Promise<IThirdPartyHardwareAdapter> {
  const adapter =
    await backgroundApi.serviceThirdPartyHardware.getAdapterForVendor(
      EHardwareVendor.trezor,
    );
  if (!adapter) {
    throw new OneKeyLocalError('Trezor adapter not available');
  }
  return adapter;
}

/**
 * The saved locator is only a hint. Callers pass identity and connection
 * context to the SDK, which owns discovery and identity verification.
 */
export async function callTrezorWithDevice<T>(
  dbDevice: IDBDevice,
  fn: (connectId: string) => Promise<Response<T>>,
): Promise<Response<T>> {
  if (!dbDevice.deviceId) {
    throw new OneKeyLocalError('Trezor device identity is required');
  }
  return fn(dbDevice.usbConnectId || dbDevice.connectId || '');
}
