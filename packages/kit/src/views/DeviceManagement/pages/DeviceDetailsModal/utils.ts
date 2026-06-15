import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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

export const TREZOR_AUTO_LOCK_OPTIONS = [
  { minute: 1 },
  { minute: 5 },
  { minute: 10 },
  { minute: 20 },
  { minute: 30 },
  { hour: 1 },
  { day: 1 },
  { day: 6 },
] as const;

export function getTrezorAutoLockOptionsMs() {
  return TREZOR_AUTO_LOCK_OPTIONS.map((option) =>
    timerUtils.getTimeDurationMs(option),
  );
}

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
  platform: {
    isDesktop?: boolean;
    isSupportDesktopBle?: boolean;
  } = platformEnv,
) {
  return (
    thirdPartyDeviceUtils.isTrezorBleBindingSupportedPlatform(platform) &&
    device?.vendor === EHardwareVendor.trezor &&
    Boolean(device.connectId) &&
    Boolean(device.deviceId) &&
    !device.bleConnectId &&
    thirdPartyDeviceUtils.isTrezorBleSupportedDevice(device)
  );
}
