import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import type { IDeviceMetaState } from './atoms';
import type { ProtocolV2DeviceInfo } from '@onekeyfe/hd-transport';

export type IPro2DeviceManagementSnapshot = {
  info?: ProtocolV2DeviceInfo;
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
    firmwareVersion: snapshot.info?.fw?.application?.version,
  };
}

export function buildPro2DeviceMetaState({
  isVerified,
  features,
}: {
  isVerified: boolean;
  features: Partial<IOneKeyDeviceFeatures>;
}): IDeviceMetaState {
  return {
    isVerified,
    unlocked: Boolean(features.unlocked),
    initialized: Boolean(features.initialized),
    backupRequired: Boolean(features.backupRequired),
    unlockedByAttachToPin: Boolean(features.unlockedAttachPin),
    passphraseEnabled: Boolean(features.passphraseProtection),
    pinOnAppEnabled: Boolean(features.attachToPinEnabled),
    autoLockDelayMs: features.autoLockDelayMs ?? undefined,
    autoShutDownDelayMs: features.autoShutdownDelayMs ?? undefined,
    language: features.language ?? undefined,
    brightness: features.brightness ?? undefined,
    hapticFeedback: Boolean(features.hapticFeedback),
    isReady: true,
  };
}
