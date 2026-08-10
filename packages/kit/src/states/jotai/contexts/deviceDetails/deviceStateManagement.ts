import { EFirmwareType } from '@onekeyfe/hd-shared';

import {
  hasDeviceStateIdentityMismatch,
  mergeDeviceStateEvent,
} from '@onekeyhq/shared/src/hardware/deviceStateUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';
import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import type { IDeviceMetaState } from './atoms';
import type { DeviceStateEvent } from '@onekeyfe/hd-core';
import type { EDeviceType } from '@onekeyfe/hd-shared';

export type IDeviceStateSnapshot = {
  state: IOneKeyDeviceState;
};

export function getDeviceStateSnapshotFromEvent({
  device,
  currentState,
  event,
}: {
  device?: {
    connectId?: string;
    usbConnectId?: string;
    bleConnectId?: string;
    deviceId?: string;
    uuid?: string;
  };
  currentState?: IOneKeyDeviceState;
  event: DeviceStateEvent;
}): IDeviceStateSnapshot | undefined {
  if (
    currentState &&
    typeof currentState.updatedAt === 'number' &&
    typeof event.state.updatedAt === 'number' &&
    (event.state.updatedAt < currentState.updatedAt ||
      (event.state.updatedAt === currentState.updatedAt &&
        event.state.revision <= currentState.revision))
  ) {
    return undefined;
  }
  const currentDeviceId = currentState?.identity.deviceId ?? device?.deviceId;
  if (
    hasDeviceStateIdentityMismatch({
      currentDeviceId,
      incomingDeviceId: event.state.identity.deviceId,
    })
  ) {
    return undefined;
  }
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
  if (event.state.identity.serialNo && device?.uuid) {
    return matchesSerialNo
      ? {
          state: mergeDeviceStateEvent({
            currentState,
            incomingState: event.state,
            changedKeys: event.changedKeys ?? ['*'],
            source: event.source,
          }),
        }
      : undefined;
  }
  if (event.state.identity.deviceId && device?.deviceId) {
    return matchesDeviceId
      ? {
          state: mergeDeviceStateEvent({
            currentState,
            incomingState: event.state,
            changedKeys: event.changedKeys ?? ['*'],
            source: event.source,
          }),
        }
      : undefined;
  }
  if (!matchesConnectId && !matchesSerialNo && !matchesDeviceId) {
    return undefined;
  }
  return {
    state: mergeDeviceStateEvent({
      currentState,
      incomingState: event.state,
      changedKeys: event.changedKeys ?? ['*'],
      source: event.source,
    }),
  };
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

export function resolveUsableWalletWithDevice(
  walletWithDevice?: IHwQrWalletWithDevice,
) {
  if (!isDeviceManagementWalletUsable(walletWithDevice)) {
    return undefined;
  }
  return walletWithDevice;
}

export function isDeviceManagementWalletUsable(
  walletWithDevice?: IHwQrWalletWithDevice,
) {
  const wallet = walletWithDevice?.wallet;
  const device = walletWithDevice?.device;
  if (!wallet || wallet.isMocked) {
    return false;
  }
  if (!wallet.deprecated) {
    return true;
  }

  const deviceType =
    device?.deviceStateInfo?.identity.deviceType ?? device?.deviceType;
  if (!deviceType || !deviceUtils.checkAllowChangeFirmwareType(deviceType)) {
    return false;
  }

  const currentFirmwareType =
    device?.deviceStateInfo?.identity.firmwareType ??
    device?.featuresInfo?.$app_firmware_type ??
    device?.featuresInfo?.firmwareType;
  if (!currentFirmwareType) {
    return false;
  }

  // Legacy wallets were created on Universal firmware. Switching firmware
  // invalidates accounts, but the device must remain manageable to switch back.
  const firmwareTypeAtCreated =
    wallet.firmwareTypeAtCreated ?? EFirmwareType.Universal;
  return currentFirmwareType !== firmwareTypeAtCreated;
}

export function resolveDeviceWithCurrentType<
  T extends { deviceType?: EDeviceType },
>(device: T, currentDeviceType?: EDeviceType): T {
  if (!currentDeviceType || device.deviceType === currentDeviceType) {
    return device;
  }
  return {
    ...device,
    deviceType: currentDeviceType,
  };
}

export function mergeDeviceSettingState(
  current: IDeviceMetaState,
  next: Partial<IDeviceMetaState>,
): IDeviceMetaState {
  return {
    ...current,
    ...next,
  };
}

export function shouldApplyDeviceSettingMutationLocally(
  deviceType?: EDeviceType,
) {
  return !isProtocolV2ProductType(deviceType);
}

export function canEditPro2DeviceWideSettings({
  unlocked: _unlocked,
}: {
  unlocked: boolean;
}) {
  // Pro 2 device-wide settings remain available while the wallet is locked.
  return true;
}

export function getDeviceMetaStaticDataFromState(state: IOneKeyDeviceState) {
  return {
    deviceName: deviceUtils.getDeviceDisplayName({ state }),
    serialNo: state.identity.serialNo ?? undefined,
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
