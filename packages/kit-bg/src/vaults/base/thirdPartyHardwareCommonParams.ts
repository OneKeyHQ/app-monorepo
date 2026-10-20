import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
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
  settings?: { vendorModel?: string; vendorModelName?: string };
  settingsRaw?: string;
}): IHardwareConnectionContext {
  if (!device) return {};
  const knownConnections: KnownDeviceConnection[] = [];
  let { usbConnectId, bleConnectId } = device;
  const { identity } = getVendorProfile(
    device.vendor as EHardwareVendor | undefined,
  );
  // Legacy connectId's original platform isn't recoverable, so we guess by
  // current platform only when no per-channel locator exists yet (a stale legacy value could hand the SDK the wrong channel). Only a connectId the vendor treats as a locator is promoted.
  if (
    !usbConnectId &&
    !bleConnectId &&
    identity.role === 'transportLocator' &&
    device.connectId &&
    identity.matchDeviceByConnectId(device.connectId)
  ) {
    if (platformEnv.isNative) bleConnectId = device.connectId;
    else usbConnectId = device.connectId;
  }
  if (usbConnectId)
    knownConnections.push({ transport: 'usb', connectId: usbConnectId });
  if (bleConnectId)
    knownConnections.push({ transport: 'ble', connectId: bleConnectId });
  const supportedTransports = thirdPartyDeviceUtils.getSupportedTransports(
    device.vendor,
    device,
  );
  return {
    knownConnections,
    ...(device.id ? { extra: { dbDeviceId: device.id } } : {}),
    ...(supportedTransports ? { supportedTransports } : {}),
  };
}

/**
 * Transport locators for one device, with legacy `connectId` folded into the
 * right channel. Read through this rather than raw fields, since old records vary and new ones leave the legacy column empty.
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
