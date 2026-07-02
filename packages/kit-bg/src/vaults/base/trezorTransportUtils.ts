import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core/errors';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice } from '../../dbs/local/types';
import type { IThirdPartyHardwareAdapter } from '../../services/ServiceHardware/adapters/types';
import type { Response } from '@onekeyfe/hwk-adapter-core';

export type IRequestTrezorBleConnectId = (params: {
  dbDevice: IDBDevice;
  usbConnectId: string;
  featuresDeviceId: string;
}) => Promise<string | null | undefined>;

export type ICallTrezorWithBleFallbackOptions = {
  requestBleConnectId?: IRequestTrezorBleConnectId;
};

type ITrezorTransportFailurePayload = {
  code?: unknown;
};

function isTrezorTransportDownFailure(
  payload?: ITrezorTransportFailurePayload,
): boolean {
  const code = payload?.code;
  return (
    code === HardwareErrorCode.DeviceDisconnected ||
    code === HardwareErrorCode.DeviceNotFound ||
    code === HardwareErrorCode.TransportError
  );
}

// A stored BLE bond / THP credential that no longer works: the device was
// wiped/re-flashed or unpaired elsewhere. The stored connectId can't be reused;
// recovery is a fresh binding/pairing, not the persisted value.
function isTrezorBleBindingStaleFailure(
  payload?: ITrezorTransportFailurePayload,
): boolean {
  const code = payload?.code;
  return (
    code === HardwareErrorCode.BleBondInvalid ||
    code === HardwareErrorCode.ThpPairingFailed
  );
}

export function isTrezorBleSupportedDevice(dbDevice: IDBDevice): boolean {
  return thirdPartyDeviceUtils.isTrezorBleSupportedDevice(dbDevice);
}

export function buildTrezorBleFallbackOptions(
  backgroundApi: IBackgroundApi,
): ICallTrezorWithBleFallbackOptions {
  return {
    requestBleConnectId: ({ dbDevice }) =>
      backgroundApi.serviceThirdPartyHardware.requestTrezorBleConnectIdForDevice(
        {
          device: dbDevice,
        },
      ),
  };
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
 * Run a Trezor hardware call, preferring the device's primary (USB) connectId
 * and recovering through BLE binding or auto-fallback discovery when transport
 * is unavailable.
 *
 * Recovery ladder when the primary call fails:
 *  1. Try saved BLE when the primary transport is down.
 *  2. Request a fresh fallback connectId and retry; the result may be BLE or
 *     the primary USB connectId if USB becomes available again.
 */
export async function callTrezorWithBleFallback<T>(
  dbDevice: IDBDevice,
  fn: (connectId: string) => Promise<Response<T>>,
  options?: ICallTrezorWithBleFallbackOptions,
): Promise<Response<T>> {
  const primaryConnectId = dbDevice.usbConnectId || dbDevice.connectId;
  let result = await fn(primaryConnectId);
  if (result.success) return result;

  const canUseBleBinding =
    thirdPartyDeviceUtils.isTrezorBleBindingSupportedPlatform(platformEnv);
  if (!canUseBleBinding) {
    return result;
  }

  const bleConnectId = dbDevice.bleConnectId;
  const featuresDeviceId = dbDevice.deviceId;

  // 1) Bound-BLE fallback. Only for transport-down — a stale bond/pairing means
  // the stored handle itself is broken, so skip straight to re-binding. No model
  // check here: an already-bound device is by definition BLE-capable.
  if (
    isTrezorTransportDownFailure(
      result.payload as ITrezorTransportFailurePayload,
    ) &&
    bleConnectId &&
    bleConnectId !== primaryConnectId
  ) {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Trezor] primary connectId failed (code=${String(
        (result.payload as ITrezorTransportFailurePayload)?.code,
      )}); falling back to bound BLE ${bleConnectId}`,
    );
    const bleResult = await fn(bleConnectId);
    if (bleResult.success) return bleResult;
    // Bound BLE also failed — don't return; fall through to re-binding so a
    // fresh connectId can replace the broken one.
    result = bleResult;
  }

  // 2) Re-discover + retry. Covers a no-longer-resolving bound BLE handle,
  // stale bond / THP credentials, and USB becoming available again.
  const finalPayload = result.payload as ITrezorTransportFailurePayload;
  if (
    options?.requestBleConnectId &&
    featuresDeviceId &&
    isTrezorBleSupportedDevice(dbDevice) &&
    (isTrezorTransportDownFailure(finalPayload) ||
      isTrezorBleBindingStaleFailure(finalPayload))
  ) {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Trezor] connectId failed (code=${String(
        finalPayload?.code,
      )}); requesting fallback discovery for device_id=${featuresDeviceId}`,
    );
    let fallbackConnectId: string | null | undefined;
    try {
      fallbackConnectId = await options.requestBleConnectId({
        dbDevice,
        usbConnectId: dbDevice.usbConnectId || primaryConnectId,
        featuresDeviceId,
      });
    } catch {
      // requestBleConnectId rejects on servicePromise timeout / UI reject.
      // Preserve the real device error (the Response contract) instead of
      // throwing a raw, unconverted non-Response error.
      return result;
    }
    if (fallbackConnectId) {
      defaultLogger.hardware.sdkLog.log(
        fallbackConnectId === primaryConnectId
          ? `[3rdPartyHW][Trezor] retrying with recovered primary USB ${fallbackConnectId}`
          : `[3rdPartyHW][Trezor] retrying with (re)bound BLE ${fallbackConnectId}`,
      );
      return fn(fallbackConnectId);
    }
  }
  return result;
}
