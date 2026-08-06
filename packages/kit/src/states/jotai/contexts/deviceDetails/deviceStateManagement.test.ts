import { EDeviceType } from '@onekeyfe/hd-shared';

import { emptyMetaState } from './atoms';
import {
  buildDeviceMetaStateFromState,
  getDeviceMetaStaticDataFromState,
  getDeviceStateSnapshotFromEvent,
  mergeDeviceSettingState,
  resolveDeviceState,
  resolveDeviceWithCurrentType,
  resolveUsableWalletWithDevice,
  shouldApplyDeviceSettingMutationLocally,
} from './deviceStateManagement';

describe('device reset wallet isolation', () => {
  it('does not expose a deprecated hardware wallet to device details', () => {
    expect(
      resolveUsableWalletWithDevice({
        wallet: { id: 'hw-wallet-1', deprecated: true },
        device: { id: 'old-device-1' },
      } as never),
    ).toBeUndefined();
  });
});

describe('device details navigation state', () => {
  it('uses the current DeviceState model when the database device is stale', () => {
    const staleDevice = {
      id: 'db-device-1',
      deviceType: EDeviceType.Unknown,
    };

    expect(resolveDeviceWithCurrentType(staleDevice, EDeviceType.Pro2)).toEqual(
      {
        id: 'db-device-1',
        deviceType: EDeviceType.Pro2,
      },
    );
  });
});

describe('device setting state updates', () => {
  it('uses the DeviceState event as the only post-mutation source for Pro2', () => {
    expect(shouldApplyDeviceSettingMutationLocally(EDeviceType.Pro2)).toBe(
      false,
    );
    expect(shouldApplyDeviceSettingMutationLocally(EDeviceType.Pro)).toBe(true);
  });

  it('applies confirmed haptic feedback changes in both directions', () => {
    const enabled = mergeDeviceSettingState(
      { ...emptyMetaState, hapticFeedback: false },
      { hapticFeedback: true },
    );
    const disabled = mergeDeviceSettingState(enabled, {
      hapticFeedback: false,
    });

    expect(enabled.hapticFeedback).toBe(true);
    expect(disabled.hapticFeedback).toBe(false);
  });

  it('keeps brightness when only auto-lock changes', () => {
    const current = {
      ...emptyMetaState,
      brightness: 43,
      autoLockDelayMs: 30_000,
    };

    expect(
      mergeDeviceSettingState(current, { autoLockDelayMs: 60_000 }),
    ).toEqual({
      ...emptyMetaState,
      brightness: 43,
      autoLockDelayMs: 60_000,
    });
  });
});

describe('getDeviceStateSnapshotFromEvent', () => {
  it.each(['classic1s', 'touch', 'pro', 'pro2'])(
    'accepts a matching %s DeviceState event',
    (deviceType) => {
      const state = {
        identity: {
          deviceType,
          serialNo: `${deviceType}_SERIAL`,
          label: `Renamed ${deviceType}`,
        },
      };

      expect(
        getDeviceStateSnapshotFromEvent({
          device: {
            deviceType,
            connectId: `${deviceType}_USB`,
            uuid: `${deviceType}_SERIAL`,
          },
          event: {
            connectId: `${deviceType}_USB`,
            state,
          },
        } as never),
      ).toEqual({ state });
    },
  );

  it('ignores an event from another device', () => {
    expect(
      getDeviceStateSnapshotFromEvent({
        device: { connectId: 'CURRENT' },
        event: {
          connectId: 'OTHER',
          state: { identity: { serialNo: 'OTHER_SERIAL' } },
        },
      } as never),
    ).toBeUndefined();
  });

  it('rejects a reused connect id when the serial number belongs to another device', () => {
    expect(
      getDeviceStateSnapshotFromEvent({
        device: { connectId: 'REUSED', uuid: 'SERIAL-CURRENT' },
        event: {
          connectId: 'REUSED',
          state: { identity: { serialNo: 'SERIAL-OTHER' } },
        },
      } as never),
    ).toBeUndefined();
  });

  it('merges only changed fields and preserves trusted runtime state', () => {
    const currentState = {
      revision: 3,
      updatedAt: 300,
      identity: {
        deviceId: 'DEVICE_ID',
        serialNo: 'SERIAL',
        label: 'Desk wallet',
        bleName: 'Pro2 6136',
      },
      status: { mode: 'normal', unlocked: false },
      settings: { language: 'en-US' },
      versions: { firmware: '1.0.0' },
    };
    const snapshot = getDeviceStateSnapshotFromEvent({
      device: {
        connectId: 'PRO2_USB',
        uuid: 'SERIAL',
        deviceId: 'DEVICE_ID',
      },
      currentState,
      event: {
        connectId: 'PRO2_USB',
        revision: 4,
        changedKeys: ['identity.bleName'],
        state: {
          ...currentState,
          revision: 4,
          updatedAt: 400,
          identity: {
            ...currentState.identity,
            deviceId: null,
            label: null,
            bleName: 'Pro2 9999',
          },
          status: { mode: 'normal', unlocked: null },
          settings: { language: null },
        },
      },
    } as never);

    expect(snapshot?.state.identity).toMatchObject({
      deviceId: 'DEVICE_ID',
      label: 'Desk wallet',
      bleName: 'Pro2 9999',
    });
    expect(snapshot?.state.status.unlocked).toBe(false);
    expect(snapshot?.state.settings.language).toBe('en-US');
  });

  it('refreshes all device settings in the page after a settings read', () => {
    const currentState = {
      revision: 3,
      updatedAt: 300,
      identity: { deviceId: 'DEVICE_ID', serialNo: 'SERIAL' },
      status: { mode: 'normal', unlocked: false },
      settings: { brightness: 30, autoLockDelayMs: 60_000 },
      versions: { firmware: '1.0.0' },
    };

    const snapshot = getDeviceStateSnapshotFromEvent({
      device: {
        connectId: 'PRO2_USB',
        uuid: 'SERIAL',
        deviceId: 'DEVICE_ID',
      },
      currentState,
      event: {
        connectId: 'PRO2_USB',
        revision: 4,
        source: 'settings-read',
        changedKeys: ['settings.brightness'],
        state: {
          ...currentState,
          revision: 4,
          updatedAt: 400,
          status: { mode: 'normal', unlocked: true },
          settings: { brightness: 70, autoLockDelayMs: 300_000 },
        },
      },
    } as never);

    expect(snapshot?.state.settings).toMatchObject({
      brightness: 70,
      autoLockDelayMs: 300_000,
    });
    expect(snapshot?.state.status.unlocked).toBe(false);
  });

  it('rejects a new wallet identity even when the physical serial still matches', () => {
    expect(
      getDeviceStateSnapshotFromEvent({
        device: {
          connectId: 'PRO2_USB',
          uuid: 'SERIAL',
          deviceId: 'OLD_DEVICE_ID',
        },
        currentState: {
          identity: {
            serialNo: 'SERIAL',
            deviceId: 'OLD_DEVICE_ID',
          },
        },
        event: {
          connectId: 'PRO2_USB',
          changedKeys: ['identity.deviceId'],
          state: {
            identity: {
              serialNo: 'SERIAL',
              deviceId: 'NEW_DEVICE_ID',
            },
          },
        },
      } as never),
    ).toBeUndefined();
  });
});

describe('DeviceState metadata projection', () => {
  it('uses the canonical device label when the persisted state has no displayName', () => {
    expect(
      getDeviceMetaStaticDataFromState({
        identity: {
          deviceType: 'pro2',
          firmwareType: 'universal',
          model: 'pro2',
          vendor: 'onekey.so',
          deviceId: '6C9F1443AF7400512AD1AD8D',
          serialNo: 'PR9999999999',
          label: 'My OneKey',
          bleName: 'Pro2 6136',
        },
        versions: { firmware: '1.0.0' },
      } as never),
    ).toEqual({
      deviceName: 'My OneKey',
      serialNo: 'PR9999999999',
      deviceType: 'pro2',
      firmwareType: 'universal',
      firmwareVersion: '1.0.0',
    });
  });

  it('uses canonical state fields while retaining the V1 software-PIN preference', () => {
    expect(
      buildDeviceMetaStateFromState({
        isVerified: true,
        pinOnAppEnabled: true,
        state: {
          status: {
            unlocked: true,
            initialized: true,
            backupRequired: false,
            passphraseProtection: true,
          },
          settings: {
            language: 'en-US',
            autoLockDelayMs: 60_000,
          },
        } as never,
      }),
    ).toMatchObject({
      isVerified: true,
      unlocked: true,
      initialized: true,
      backupRequired: false,
      passphraseEnabled: true,
      pinOnAppEnabled: true,
      language: 'en-US',
      autoLockDelayMs: 60_000,
      isReady: true,
    });
  });

  it('uses the last trusted passphrase setting while Pro 2 is locked', () => {
    expect(
      buildDeviceMetaStateFromState({
        isVerified: true,
        state: {
          status: {
            unlocked: false,
            passphraseProtection: true,
          },
          settings: {},
        } as never,
      }),
    ).toMatchObject({
      unlocked: false,
      passphraseEnabled: true,
    });
  });

  it('prefers the newest event snapshot over persisted state', () => {
    const persistedState = { revision: 1 };
    const snapshotState = { revision: 2 };

    expect(
      resolveDeviceState({
        persistedState,
        snapshot: { state: snapshotState },
      } as never),
    ).toBe(snapshotState);
  });
});
