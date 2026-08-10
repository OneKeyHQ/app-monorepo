import { EHardwareTransportType } from '@onekeyhq/shared/types';

/**
 * Match the x branch: OneKey wallet creation keeps the transport selected by
 * Onboarding, while third-party fused device lists refine it with raw.connectionType.
 */
export function resolveHwWalletTransportType(params: {
  globalTransportType: EHardwareTransportType;
  deviceConnectionType: 'usb' | 'ble' | undefined;
  isNative: boolean;
}): EHardwareTransportType {
  const { globalTransportType, deviceConnectionType, isNative } = params;
  const globalIsUsb =
    globalTransportType === EHardwareTransportType.WEBUSB ||
    globalTransportType === EHardwareTransportType.Bridge;
  const globalIsBle =
    globalTransportType === EHardwareTransportType.BLE ||
    globalTransportType === EHardwareTransportType.DesktopWebBle;
  if (deviceConnectionType === 'ble' && globalIsUsb) {
    return isNative
      ? EHardwareTransportType.BLE
      : EHardwareTransportType.DesktopWebBle;
  }
  if (deviceConnectionType === 'usb' && globalIsBle && !isNative) {
    return EHardwareTransportType.WEBUSB;
  }
  return globalTransportType;
}
