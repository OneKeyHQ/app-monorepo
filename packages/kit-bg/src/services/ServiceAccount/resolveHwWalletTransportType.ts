import { EHardwareTransportType } from '@onekeyhq/shared/types';

/**
 * Decide which transport a hardware wallet record is stored under.
 *
 * The global transport flag (force atom / settings) is only a UI default. The
 * picked device's ACTUAL connectionType is authoritative: the desktop fused
 * USB+BLE scan can surface either transport while the global default points the
 * other way, and trusting the global would file the handle under the wrong
 * field (BLE handle into usbConnectId, or a USB serial into bleConnectId),
 * leaving the device unreachable on its real transport.
 *
 * Both mismatches are corrected, in both directions:
 *  - BLE device under a USB-family default → BLE (native) / DesktopWebBle.
 *  - USB device under a BLE-family default → WEBUSB (desktop/web only; USB is
 *    not a native transport). WEBUSB is the desktop USB default; a Bridge user's
 *    global is already USB-family, so this branch never overrides Bridge.
 *
 * Only third-party devices (Trezor + Ledger) carry a connectionType. OneKey HD
 * devices carry none → the global value is returned unchanged, so the OneKey HD
 * flow is untouched.
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
