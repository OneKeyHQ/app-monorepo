import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import type { IDeviceMetaState } from './atoms';
export type IPro2DeviceManagementSnapshot = {
  state: IOneKeyDeviceState;
};

export function resolvePro2DeviceState({
  persistedState,
  snapshot,
}: {
  persistedState?: IOneKeyDeviceState;
  snapshot?: IPro2DeviceManagementSnapshot;
}) {
  return snapshot?.state ?? persistedState;
}

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

export function getPro2DeviceMetaStaticData(state: IOneKeyDeviceState) {
  return {
    deviceName: state.identity.displayName,
    deviceType: state.identity.deviceType,
    firmwareType: state.identity.firmwareType,
    firmwareVersion: state.versions.firmware ?? '0.0.0',
  };
}

export function buildPro2DeviceMetaState({
  isVerified,
  state,
}: {
  isVerified: boolean;
  state: IOneKeyDeviceState;
}): IDeviceMetaState {
  return {
    isVerified,
    unlocked: Boolean(state.status.unlocked),
    initialized: Boolean(state.status.initialized),
    backupRequired: Boolean(state.status.backupRequired),
    unlockedByAttachToPin: Boolean(state.status.unlockedAttachPin),
    passphraseEnabled: Boolean(state.status.passphraseProtection),
    pinOnAppEnabled: Boolean(state.status.attachToPinEnabled),
    autoLockDelayMs: state.settings.autoLockDelayMs ?? undefined,
    autoShutDownDelayMs: state.settings.autoShutdownDelayMs ?? undefined,
    language: state.settings.language ?? undefined,
    brightness: state.settings.brightness ?? undefined,
    hapticFeedback: Boolean(state.settings.hapticFeedback),
    isReady: true,
  };
}
