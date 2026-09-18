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
  // Legacy records only stored the endpoint for their original platform, and
  // which platform that was is not recoverable from the value — so the guess
  // is "whatever channel this platform uses".
  //
  // Only guess when there is nothing better. A record that already carries any
  // per-channel locator has been written by the current code, which means its
  // legacy column is a leftover: after a BLE rebind it still holds the
  // PREVIOUS address, and promoting that into the empty USB slot would hand
  // the SDK a BLE address as a USB locator.
  //
  // Logical wallet identities must never be promoted to physical locators.
  if (
    !usbConnectId &&
    !bleConnectId &&
    getVendorProfile(device.vendor as EHardwareVendor | undefined).identity
      .role === 'transportLocator' &&
    device.connectId
  ) {
    if (platformEnv.isNative) bleConnectId = device.connectId;
    else usbConnectId = device.connectId;
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

/**
 * The transport locators for one device, with a legacy `connectId` folded into
 * whichever channel it belongs to. Read locators through this rather than off
 * the record: new records leave the legacy column empty, and old ones put
 * either channel in it depending on how the wallet was first onboarded.
 */
export function thirdPartyTransportLocators(device?: {
  vendor?: string;
  connectId?: string;
  usbConnectId?: string;
  bleConnectId?: string;
}): { usbConnectId?: string; bleConnectId?: string } {
  const context = thirdPartyConnectionContextFromDevice(device);
  const locators: { usbConnectId?: string; bleConnectId?: string } = {};
  for (const connection of context.knownConnections ?? []) {
    if (connection.transport === 'usb')
      locators.usbConnectId = connection.connectId;
    if (connection.transport === 'ble')
      locators.bleConnectId = connection.connectId;
  }
  return locators;
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
  operationId?: string;
} {
  const passphraseState = deviceParams?.deviceCommonParams?.passphraseState;
  const useEmptyPassphrase =
    deviceParams?.deviceCommonParams?.useEmptyPassphrase;
  const operationId = deviceParams?.deviceCommonParams?.operationId;
  return {
    ...thirdPartyConnectionContextFromDevice(deviceParams?.dbDevice),
    ...(passphraseState ? { passphraseState } : {}),
    ...(useEmptyPassphrase !== undefined ? { useEmptyPassphrase } : {}),
    ...(operationId ? { operationId } : {}),
  };
}
