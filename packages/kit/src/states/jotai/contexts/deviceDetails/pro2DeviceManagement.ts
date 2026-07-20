import type { IDeviceMetaState } from './atoms';
import type {
  DeviceSettings,
  DeviceStatus,
  ProtocolV2DeviceInfo,
} from '@onekeyfe/hd-transport';

export type IPro2DeviceManagementSnapshot = {
  info?: ProtocolV2DeviceInfo;
  status: DeviceStatus;
  settings?: DeviceSettings;
};

export function canEditPro2DeviceWideSettings({
  unlocked: _unlocked,
}: {
  unlocked: boolean;
}) {
  // DeviceSettingsSet accepts device-wide preferences while locked. Reading
  // DeviceSettings still requires unlock, but that must not disable editing.
  return true;
}

export function shouldRefreshDeviceSettingsAfterUpdate({
  isPro2,
  unlocked,
}: {
  isPro2: boolean;
  unlocked: boolean;
}) {
  return !isPro2 || unlocked;
}

export function getPro2DeviceMetaStaticOverrides(
  snapshot: IPro2DeviceManagementSnapshot,
) {
  return {
    deviceName: snapshot.info?.coprocessor?.bt_adv_name,
    firmwareVersion: snapshot.info?.fw?.application?.version,
  };
}

export function buildPro2DeviceMetaState({
  isVerified,
  snapshot,
}: {
  isVerified: boolean;
  snapshot: IPro2DeviceManagementSnapshot;
}): IDeviceMetaState {
  const { status, settings } = snapshot;
  return {
    isVerified,
    unlocked: Boolean(status.unlocked),
    initialized: Boolean(status.init_states),
    backupRequired: Boolean(status.backup_required),
    unlockedByAttachToPin: Boolean(status.unlocked_by_attach_to_pin),
    passphraseEnabled: Boolean(status.passphrase_enabled),
    pinOnAppEnabled: Boolean(status.attach_to_pin_enabled),
    // cspell:disable-next-line
    autoLockDelayMs: settings?.autolock_delay_ms,
    // cspell:disable-next-line
    autoShutDownDelayMs: settings?.autoshutdown_delay_ms,
    language: settings?.language,
    brightness: settings?.brightness,
    hapticFeedback: Boolean(settings?.haptic_feedback),
    isReady: true,
  };
}
