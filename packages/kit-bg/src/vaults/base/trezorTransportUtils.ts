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
 * and falling back to a bound BLE connectId on a transport-disconnect failure.
 *
 * Trezor's fused connector routes by connectId, so picking the right connectId
 * IS the transport selection. This is the Trezor equivalent of OneKey's
 * `getCompatibleConnectId` / the Ledger fingerprint wrapper — kept Trezor-side
 * so the OneKey / Ledger paths are untouched, and so future Trezor chain
 * keyrings (btc / sol / tron) reuse one place. Extend here if more vendors need
 * the same.
 *
 * Until a device is bound over BLE (`dbDevice.bleConnectId` is empty) this is a
 * no-op pass-through — safe to wire everywhere. Binding (how `bleConnectId` gets
 * onto the record) is a separate flow:
 * `ServiceThirdPartyHardware.bindTrezorBleConnectId` + the pairing UI.
 */
export async function callTrezorWithBleFallback<T>(
  dbDevice: IDBDevice,
  fn: (connectId: string) => Promise<Response<T>>,
  options?: ICallTrezorWithBleFallbackOptions,
): Promise<Response<T>> {
  const primaryConnectId = dbDevice.usbConnectId || dbDevice.connectId;
  const result = await fn(primaryConnectId);
  if (result.success) return result;

  const failurePayload = result.payload as
    | ITrezorTransportFailurePayload
    | undefined;
  const code = failurePayload?.code;
  const isTransportDown = isTrezorTransportDownFailure(failurePayload);
  const canUseBleBinding =
    thirdPartyDeviceUtils.isTrezorBleBindingSupportedPlatform(platformEnv);
  const bleConnectId = dbDevice.bleConnectId;
  if (
    isTransportDown &&
    canUseBleBinding &&
    bleConnectId &&
    bleConnectId !== primaryConnectId
  ) {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Trezor] primary connectId failed (code=${String(
        code,
      )}); falling back to bound BLE ${bleConnectId}`,
    );
    return fn(bleConnectId);
  }
  const featuresDeviceId = dbDevice.deviceId;
  if (
    isTransportDown &&
    options?.requestBleConnectId &&
    featuresDeviceId &&
    canUseBleBinding &&
    isTrezorBleSupportedDevice(dbDevice)
  ) {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Trezor] primary connectId failed (code=${String(
        code,
      )}); requesting BLE binding for device_id=${featuresDeviceId}`,
    );
    const boundBleConnectId = await options.requestBleConnectId({
      dbDevice,
      usbConnectId: dbDevice.usbConnectId || primaryConnectId,
      featuresDeviceId,
    });
    if (boundBleConnectId && boundBleConnectId !== primaryConnectId) {
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] retrying with newly bound BLE ${boundBleConnectId}`,
      );
      return fn(boundBleConnectId);
    }
  }
  return result;
}
