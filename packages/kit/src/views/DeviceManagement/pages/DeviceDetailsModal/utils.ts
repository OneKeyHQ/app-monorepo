import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { EDeviceType } from '@onekeyfe/hd-shared';

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

export function shouldShowDeviceInteractiveSections(
  deviceType: EDeviceType | undefined,
  deviceStateReady: boolean,
) {
  return Boolean(deviceType) || deviceStateReady;
}

export type IFirmwareTypeChangeAvailability =
  | 'enabled'
  | 'comingSoon'
  | 'hidden';

export function getFirmwareTypeChangeAvailability(
  deviceType: EDeviceType | undefined,
): IFirmwareTypeChangeAvailability {
  if (isProtocolV2ProductType(deviceType)) {
    return 'hidden';
  }
  if (deviceType && deviceUtils.checkAllowChangeFirmwareType(deviceType)) {
    return 'enabled';
  }
  return 'hidden';
}

export async function syncRelevantDeviceStateEvent<T>({
  event,
  applyEvent,
  refresh,
}: {
  event: T;
  applyEvent: (event: T) => Promise<boolean>;
  refresh: () => Promise<unknown>;
}) {
  const applied = await applyEvent(event);
  if (applied) {
    await refresh();
  }
  return applied;
}
