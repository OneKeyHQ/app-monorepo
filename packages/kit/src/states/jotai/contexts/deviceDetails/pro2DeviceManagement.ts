import { EDeviceType } from '@onekeyfe/hd-shared';

import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import type { IDeviceMetaState } from './atoms';
import type { DeviceStateEvent, IDeviceType } from '@onekeyfe/hd-core';
export type IPro2DeviceManagementSnapshot = {
  state: IOneKeyDeviceState;
};

export function getPro2SnapshotFromDeviceStateEvent({
  device,
  event,
}: {
  device?: {
    deviceType?: IDeviceType;
    connectId?: string;
    usbConnectId?: string;
    bleConnectId?: string;
    deviceId?: string;
    uuid?: string;
  };
  event: DeviceStateEvent;
}): IPro2DeviceManagementSnapshot | undefined {
  if (device?.deviceType !== EDeviceType.Pro2) {
    return undefined;
  }
  const normalizedEventConnectId = event.connectId?.toLowerCase();
  const matchesConnectId = Boolean(
    normalizedEventConnectId &&
    [device.connectId, device.usbConnectId, device.bleConnectId].some(
      (connectId) => connectId?.toLowerCase() === normalizedEventConnectId,
    ),
  );
  const matchesSerialNo = Boolean(
    event.state.identity.serialNo &&
    device.uuid === event.state.identity.serialNo,
  );
  const matchesDeviceId = Boolean(
    event.state.identity.deviceId &&
    device.deviceId === event.state.identity.deviceId,
  );
  return matchesConnectId || matchesSerialNo || matchesDeviceId
    ? { state: event.state }
    : undefined;
}

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
    firmwareVersion: state.versions.firmware ?? undefined,
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
    unlocked: state.status.unlocked ?? undefined,
    initialized: state.status.initialized ?? undefined,
    backupRequired: state.status.backupRequired ?? undefined,
    unlockedByAttachToPin: state.status.unlockedAttachPin ?? undefined,
    passphraseEnabled: state.status.passphraseProtection ?? undefined,
    pinOnAppEnabled: state.status.attachToPinEnabled ?? undefined,
    autoLockDelayMs: state.settings.autoLockDelayMs ?? undefined,
    autoShutDownDelayMs: state.settings.autoShutdownDelayMs ?? undefined,
    language: state.settings.language ?? undefined,
    brightness: state.settings.brightness ?? undefined,
    hapticFeedback: state.settings.hapticFeedback ?? undefined,
    isReady: true,
  };
}
