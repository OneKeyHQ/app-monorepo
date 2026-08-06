import { EHardwareTransportType } from '@onekeyhq/shared/types';

export function shouldKeepDesktopBleForFirmwareUpdate({
  forceTransportType,
  currentTransportType,
}: {
  forceTransportType: EHardwareTransportType | undefined;
  currentTransportType: EHardwareTransportType;
}) {
  return (
    (forceTransportType ?? currentTransportType) ===
    EHardwareTransportType.DesktopWebBle
  );
}

export function isBluetoothFirmwareUpdateTransport({
  isNative,
  hardwareTransportType,
}: {
  isNative: boolean | undefined;
  hardwareTransportType: EHardwareTransportType | undefined;
}) {
  return (
    isNative || hardwareTransportType === EHardwareTransportType.DesktopWebBle
  );
}
