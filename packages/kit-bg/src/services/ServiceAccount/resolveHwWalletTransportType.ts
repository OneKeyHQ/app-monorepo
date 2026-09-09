import { EHardwareTransportType } from '@onekeyhq/shared/types';

import type { SearchDevice } from '@onekeyfe/hd-core';

/**
 * Resolve the transport from the device endpoint that was actually selected.
 * The global transport is only a fallback: OneKey devices expose commType,
 * while third-party fused scans expose raw.connectionType.
 */
export function resolveHwWalletTransportType(params: {
  globalTransportType: EHardwareTransportType;
  deviceConnectionType: 'usb' | 'ble' | undefined;
  deviceCommType?: SearchDevice['commType'];
  isNative: boolean;
}): EHardwareTransportType {
  const {
    globalTransportType,
    deviceConnectionType,
    deviceCommType,
    isNative,
  } = params;
  let commTypeConnectionType: 'usb' | 'ble' | undefined;
  if (
    deviceCommType === 'ble' ||
    deviceCommType === 'webble' ||
    deviceCommType === 'electron-ble'
  ) {
    commTypeConnectionType = 'ble';
  } else if (
    deviceCommType === 'usb' ||
    deviceCommType === 'webusb' ||
    deviceCommType === 'bridge'
  ) {
    commTypeConnectionType = 'usb';
  }
  const actualConnectionType = deviceConnectionType ?? commTypeConnectionType;
  const globalIsUsb =
    globalTransportType === EHardwareTransportType.WEBUSB ||
    globalTransportType === EHardwareTransportType.Bridge;
  const globalIsBle =
    globalTransportType === EHardwareTransportType.BLE ||
    globalTransportType === EHardwareTransportType.DesktopWebBle;
  if (actualConnectionType === 'ble' && globalIsUsb) {
    return isNative
      ? EHardwareTransportType.BLE
      : EHardwareTransportType.DesktopWebBle;
  }
  if (actualConnectionType === 'usb' && globalIsBle && !isNative) {
    return EHardwareTransportType.WEBUSB;
  }
  return globalTransportType;
}
