import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EHardwareVendor,
  IDeviceCommonParams,
  IDeviceSharedCallParams,
  IHardwareOperationContext,
} from '@onekeyhq/shared/types/device';

import type {
  ICommonCallParams,
  IHardwareConnectionContext,
  KnownDeviceConnection,
} from '@onekeyfe/hwk-adapter-core';

/** Host record ids stay separate from the device/wallet identity used by the SDK. */
export function thirdPartyConnectionContextFromDevice(device?: {
  id?: string;
  vendor?: string;
  connectId?: string;
  usbConnectId?: string;
  bleConnectId?: string;
}): IHardwareConnectionContext {
  if (!device) return {};
  const knownConnections: KnownDeviceConnection[] = [];
  let { usbConnectId, bleConnectId } = device;
  // Legacy records only stored the endpoint for their original platform.
  // Logical wallet identities must never be promoted to physical locators.
  if (
    getVendorProfile(device.vendor as EHardwareVendor | undefined)
      .connectIdRole === 'transportLocator' &&
    device.connectId &&
    device.connectId !== usbConnectId &&
    device.connectId !== bleConnectId
  ) {
    if (platformEnv.isNative) bleConnectId ||= device.connectId;
    else usbConnectId ||= device.connectId;
  }
  if (usbConnectId)
    knownConnections.push({ transport: 'usb', connectId: usbConnectId });
  if (bleConnectId)
    knownConnections.push({ transport: 'ble', connectId: bleConnectId });
  return {
    knownConnections,
    ...(device.id ? { extra: { dbDeviceId: device.id } } : {}),
  };
}

export function thirdPartyCommonCallParamsForCreateScene(scene: {
  isAutoCreateMultiNetwork?: boolean;
}): ICommonCallParams | undefined {
  return scene.isAutoCreateMultiNetwork ? { autoInstallApp: false } : undefined;
}

export function withHardwareOperationContext(
  deviceParams: IDeviceSharedCallParams,
  hardwareOperationContext: IHardwareOperationContext | undefined,
): IDeviceSharedCallParams {
  if (!hardwareOperationContext) {
    return deviceParams;
  }

  const deviceCommonParams: IDeviceCommonParams =
    deviceParams.deviceCommonParams ?? {
      passphraseState: undefined,
      useEmptyPassphrase: undefined,
    };
  return {
    ...deviceParams,
    deviceCommonParams: {
      ...deviceCommonParams,
      ...hardwareOperationContext,
    },
  };
}

export function thirdPartyPassphraseParamsFromDeviceParams(
  deviceParams: IDeviceSharedCallParams | undefined,
): IHardwareConnectionContext & {
  passphraseState?: string;
  useEmptyPassphrase?: boolean;
  interactionId?: string;
} {
  const passphraseState = deviceParams?.deviceCommonParams?.passphraseState;
  const useEmptyPassphrase =
    deviceParams?.deviceCommonParams?.useEmptyPassphrase;
  const interactionId = deviceParams?.deviceCommonParams?.interactionId;
  return {
    ...thirdPartyConnectionContextFromDevice(deviceParams?.dbDevice),
    ...(passphraseState ? { passphraseState } : {}),
    ...(useEmptyPassphrase !== undefined ? { useEmptyPassphrase } : {}),
    ...(interactionId ? { interactionId } : {}),
  };
}
