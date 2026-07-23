import {
  buildDeviceMetaStateFromState,
  getDeviceMetaStaticDataFromState,
  getDeviceStateSnapshotFromEvent,
  resolveDeviceState,
} from './deviceStateManagement';

describe('getDeviceStateSnapshotFromEvent', () => {
  it.each(['classic1s', 'touch', 'pro', 'pro2'])(
    'accepts a matching %s DeviceState event',
    (deviceType) => {
      const state = {
        identity: {
          deviceType,
          serialNo: `${deviceType}_SERIAL`,
          label: `Renamed ${deviceType}`,
          displayName: `Renamed ${deviceType}`,
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
        displayName: 'Desk wallet',
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
            displayName: 'Pro2 9999',
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
      displayName: 'Desk wallet',
    });
    expect(snapshot?.state.status.unlocked).toBe(false);
    expect(snapshot?.state.settings.language).toBe('en-US');
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
  it('builds static metadata for a Protocol V1 device without legacy features', () => {
    expect(
      getDeviceMetaStaticDataFromState({
        identity: {
          displayName: 'My Classic 1S',
          deviceType: 'classic1s',
          firmwareType: 'universal',
        },
        versions: { firmware: '3.11.0' },
      } as never),
    ).toEqual({
      deviceName: 'My Classic 1S',
      deviceType: 'classic1s',
      firmwareType: 'universal',
      firmwareVersion: '3.11.0',
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
