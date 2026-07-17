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
    passphraseEnabled: Boolean(status.passphrase_enabled),
    pinOnAppEnabled: Boolean(status.attach_to_pin_enabled),
    // cspell:disable-next-line
    autoLockDelayMs: settings?.autolock_delay_ms,
    // cspell:disable-next-line
    autoShutDownDelayMs: settings?.autoshutdown_delay_ms,
    language: settings?.language,
    hapticFeedback: Boolean(settings?.haptic_feedback),
    isReady: true,
  };
}
