import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  hasAuthoritativeDeviceInfoVersionChange,
  hasDeviceStateIdentityMismatch,
  mergeDeviceStateEvent,
} from '@onekeyhq/shared/src/hardware/deviceStateUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';
import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import type { IDeviceMetaState, IDeviceMetaStatic } from './atoms';
import type { DeviceStateEvent } from '@onekeyfe/hd-core';

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
    typeof event.state.updatedAt === 'number'
  ) {
    // Explicit hardware read-backs may reveal changes already present in the
    // SDK cache without advancing its metadata.
    const acceptsEqualMetadata =
      event.source === 'settings-read' ||
      hasAuthoritativeDeviceInfoVersionChange({
        currentState,
        incomingState: event.state,
        changedKeys: event.changedKeys,
        source: event.source,
      });
    const isStale =
      event.state.updatedAt < currentState.updatedAt ||
      (event.state.updatedAt === currentState.updatedAt &&
        (event.state.revision < currentState.revision ||
          (event.state.revision === currentState.revision &&
            !acceptsEqualMetadata)));
    if (isStale) {
      return undefined;
    }
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

/**
 * Refresh reads can be served from short-lived DB record caches that may
 * predate the write which triggered the refresh. Never let such a read
 * regress a snapshot that a newer device-state event already applied.
 */
export function pickNewerDeviceStateSnapshot({
  current,
  incoming,
}: {
  current?: IDeviceStateSnapshot;
  incoming?: IDeviceStateSnapshot;
}): IDeviceStateSnapshot | undefined {
  if (!current) {
    return incoming;
  }
  if (!incoming) {
    return current;
  }
  const currentUpdatedAt =
    typeof current.state.updatedAt === 'number' ? current.state.updatedAt : 0;
  const incomingUpdatedAt =
    typeof incoming.state.updatedAt === 'number' ? incoming.state.updatedAt : 0;
  if (incomingUpdatedAt !== currentUpdatedAt) {
    return incomingUpdatedAt > currentUpdatedAt ? incoming : current;
  }
  return (incoming.state.revision ?? 0) >= (current.state.revision ?? 0)
    ? incoming
    : current;
}

export function isDeviceManagementWalletUsable(
  walletWithDevice?: IHwQrWalletWithDevice,
) {
  return Boolean(walletWithDevice?.wallet && walletWithDevice.device);
}

export function resolveUsableWalletWithDevice(
  walletWithDevice?: IHwQrWalletWithDevice,
  allWallets: IHwQrWalletWithDevice[] = [],
) {
  if (!isDeviceManagementWalletUsable(walletWithDevice)) {
    return undefined;
  }
  const isQrWallet = accountUtils.isQrWallet({
    walletId: walletWithDevice?.wallet.id,
  });
  return (
    allWallets.find(
      (item) =>
        !item.wallet.deprecated &&
        !accountUtils.isHwHiddenWallet({ wallet: item.wallet }) &&
        accountUtils.isQrWallet({ walletId: item.wallet.id }) === isQrWallet &&
        deviceUtils.isSamePhysicalDevice(item.device, walletWithDevice?.device),
    ) ?? walletWithDevice
  );
}

export function getDeviceManagementWallets(
  wallets: IHwQrWalletWithDevice[],
): IHwQrWalletWithDevice[] {
  const devices: IHwQrWalletWithDevice[] = [];
  for (const item of wallets) {
    if (
      isDeviceManagementWalletUsable(item) &&
      !accountUtils.isHwHiddenWallet({ wallet: item.wallet })
    ) {
      const representative = resolveUsableWalletWithDevice(item, wallets);
      if (
        representative &&
        !devices.some(
          (entry) =>
            accountUtils.isQrWallet({ walletId: entry.wallet.id }) ===
              accountUtils.isQrWallet({ walletId: representative.wallet.id }) &&
            deviceUtils.isSamePhysicalDevice(
              entry.device,
              representative.device,
            ),
        )
      ) {
        devices.push(representative);
      }
    }
  }
  return devices;
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
  next?: Partial<IDeviceMetaState>,
) {
  return (
    !isProtocolV2ProductType(deviceType) ||
    typeof next?.passphraseEnabled === 'boolean'
  );
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
    bleName: state.identity.bleName ?? undefined,
    serialNo: state.identity.serialNo ?? undefined,
    deviceType: state.identity.deviceType,
    firmwareType: state.identity.firmwareType,
    firmwareVersion: state.versions.firmware ?? undefined,
  };
}

export function getDeviceSecondaryIdentifier(
  deviceMetaStatic: Pick<
    IDeviceMetaStatic,
    'bleName' | 'deviceType' | 'serialNo'
  >,
) {
  return deviceMetaStatic.deviceType === EDeviceType.Pro2
    ? deviceMetaStatic.bleName || deviceMetaStatic.serialNo
    : deviceMetaStatic.serialNo;
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
