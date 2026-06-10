import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

type IDeviceConnectionInfo = {
  vendor?: EHardwareVendor;
  connectId?: string;
  deviceId?: string;
  bleConnectId?: string;
  settings?: {
    vendorModel?: string;
    vendorModelName?: string;
  };
  settingsRaw?: string;
};

export function canOpenDeviceManagementDetails(
  vendor: EHardwareVendor | undefined,
) {
  const profile = getVendorProfile(vendor ?? EHardwareVendor.onekey);
  return profile.supportsDeviceManagementDetails;
}

export function buildDeviceDetailsVisibility({
  vendor,
  isQrWallet,
  hasLoadedDevice,
}: {
  vendor: EHardwareVendor | undefined;
  isQrWallet: boolean;
  hasLoadedDevice: boolean;
}) {
  const profile = !isQrWallet && vendor ? getVendorProfile(vendor) : undefined;
  return {
    vendorProfile: profile,
    showFirmwareActions:
      Boolean(profile?.supportsFirmwareUpdate) && hasLoadedDevice,
    showDeviceSettings:
      Boolean(profile?.supportsDeviceSettings) && hasLoadedDevice,
    showDeviceSupport: Boolean(profile?.supportsDeviceAbout) && hasLoadedDevice,
    showPassphraseSettings:
      Boolean(profile?.supportsPassphraseSetting) && hasLoadedDevice,
    showDeviceConnection: !isQrWallet && hasLoadedDevice,
  };
}

export function canShowTrezorBleBinding(
  device: IDeviceConnectionInfo | undefined,
) {
  return (
    device?.vendor === EHardwareVendor.trezor &&
    Boolean(device.connectId) &&
    Boolean(device.deviceId) &&
    !device.bleConnectId &&
    thirdPartyDeviceUtils.isTrezorBleSupportedDevice(device)
  );
}
