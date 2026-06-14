import { EHardwareTransportType } from '@onekeyhq/shared/types';

/**
 * Decide which transport a hardware wallet record is stored under.
 *
 * The global transport flag (force atom / settings) is only a UI default. The
 * picked device's ACTUAL connectionType is authoritative: on desktop the fused
 * USB+BLE scan can surface a BLE device while the global default is USB, and
 * trusting the global would file the BLE handle into usbConnectId, leaving
 * bleConnectId empty and the device unreachable over BLE.
 *
 * Only the BLE-under-USB-default mismatch is corrected. Everything else (USB
 * devices, native BLE, OneKey HD devices that carry no connectionType) returns
 * the global value unchanged, so OneKey/Ledger flows are untouched.
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
  if (deviceConnectionType === 'ble' && globalIsUsb) {
    return isNative
      ? EHardwareTransportType.BLE
      : EHardwareTransportType.DesktopWebBle;
  }
  return globalTransportType;
}
