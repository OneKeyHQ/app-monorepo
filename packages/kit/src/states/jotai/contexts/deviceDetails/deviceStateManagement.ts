import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import type { IDeviceMetaState } from './atoms';
import type { DeviceStateEvent } from '@onekeyfe/hd-core';

export type IDeviceStateSnapshot = {
  state: IOneKeyDeviceState;
};

export function getDeviceStateSnapshotFromEvent({
  device,
  event,
}: {
  device?: {
    connectId?: string;
    usbConnectId?: string;
    bleConnectId?: string;
    deviceId?: string;
    uuid?: string;
  };
  event: DeviceStateEvent;
}): IDeviceStateSnapshot | undefined {
  const normalizedEventConnectId = event.connectId?.toLowerCase();
  const matchesConnectId = Boolean(
    normalizedEventConnectId &&
    [device?.connectId, device?.usbConnectId, device?.bleConnectId].some(
      (connectId) => connectId?.toLowerCase() === normalizedEventConnectId,
    ),
  );
  const matchesSerialNo = Boolean(
    event.state.identity.serialNo &&
    device?.uuid === event.state.identity.serialNo,
  );
  const matchesDeviceId = Boolean(
    event.state.identity.deviceId &&
    device?.deviceId === event.state.identity.deviceId,
  );
  return matchesConnectId || matchesSerialNo || matchesDeviceId
    ? { state: event.state }
    : undefined;
}

export function resolveDeviceState({
  persistedState,
  snapshot,
}: {
  persistedState?: IOneKeyDeviceState;
  snapshot?: IDeviceStateSnapshot;
}) {
  return snapshot?.state ?? persistedState;
}

export function canEditPro2DeviceWideSettings({
  unlocked: _unlocked,
}: {
  unlocked: boolean;
}) {
  // Pro 2 的公开设置支持在锁定状态下读取和修改。
  return true;
}

export function getDeviceMetaStaticDataFromState(state: IOneKeyDeviceState) {
  return {
    deviceName: state.identity.displayName,
    deviceType: state.identity.deviceType,
    firmwareType: state.identity.firmwareType,
    firmwareVersion: state.versions.firmware ?? undefined,
  };
}

export function buildDeviceMetaStateFromState({
  isVerified,
  pinOnAppEnabled,
  state,
}: {
  isVerified: boolean;
  pinOnAppEnabled?: boolean;
  state: IOneKeyDeviceState;
}): IDeviceMetaState {
  return {
    isVerified,
    unlocked: state.status.unlocked ?? undefined,
    initialized: state.status.initialized ?? undefined,
    backupRequired: state.status.backupRequired ?? undefined,
    unlockedByAttachToPin: state.status.unlockedAttachPin ?? undefined,
    passphraseEnabled: state.status.passphraseProtection ?? undefined,
    pinOnAppEnabled:
      pinOnAppEnabled ?? state.status.attachToPinEnabled ?? undefined,
    autoLockDelayMs: state.settings.autoLockDelayMs ?? undefined,
    autoShutDownDelayMs: state.settings.autoShutdownDelayMs ?? undefined,
    language: state.settings.language ?? undefined,
    brightness: state.settings.brightness ?? undefined,
    hapticFeedback: state.settings.hapticFeedback ?? undefined,
    isReady: true,
  };
}
