import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice } from '../../dbs/local/types';
import type { IThirdPartyHardwareAdapter } from '../../services/ServiceHardware/adapters/types';
import type { Response } from '@onekeyfe/hwk-adapter-core';

export type ICallTrezorWithBleFallbackOptions = {
  /** Kept for call-site compatibility; only the SDK may decide safe replay. */
  replayPolicy: 'read-only' | 'never';
};

export function isTrezorBleSupportedDevice(dbDevice: IDBDevice): boolean {
  return thirdPartyDeviceUtils.isTrezorBleSupportedDevice(dbDevice);
}

export function buildTrezorBleFallbackOptions(
  _backgroundApi: IBackgroundApi,
  replayPolicy: 'read-only' | 'never' = 'read-only',
): ICallTrezorWithBleFallbackOptions {
  return { replayPolicy };
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
 * Compatibility entry for existing callers. They pass the expected deviceId
 * and known connection context to the SDK. The saved locator is only a hint;
 * the SDK owns discovery, explicit binding and identity verification.
 */
export async function callTrezorWithBleFallback<T>(
  dbDevice: IDBDevice,
  fn: (connectId: string) => Promise<Response<T>>,
  _options: ICallTrezorWithBleFallbackOptions,
): Promise<Response<T>> {
  if (!dbDevice.deviceId) {
    throw new OneKeyLocalError('Trezor device identity is required');
  }
  return fn(dbDevice.usbConnectId || dbDevice.connectId || '');
}
