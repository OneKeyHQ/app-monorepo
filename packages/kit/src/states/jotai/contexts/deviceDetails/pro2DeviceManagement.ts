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
  // Pro2 的公开设置支持在锁定状态下读取和修改。
  return true;
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
  lastKnownPassphraseEnabled,
  snapshot,
}: {
  isVerified: boolean;
  lastKnownPassphraseEnabled?: boolean;
  snapshot: IPro2DeviceManagementSnapshot;
}): IDeviceMetaState {
  const { status, settings } = snapshot;
  const passphraseEnabled =
    status.unlocked === true && typeof status.passphrase_enabled === 'boolean'
      ? status.passphrase_enabled
      : (lastKnownPassphraseEnabled ?? false);
  return {
    isVerified,
    unlocked: Boolean(status.unlocked),
    initialized: Boolean(status.init_states),
    backupRequired: Boolean(status.backup_required),
    unlockedByAttachToPin: Boolean(status.unlocked_by_attach_to_pin),
    passphraseEnabled,
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
