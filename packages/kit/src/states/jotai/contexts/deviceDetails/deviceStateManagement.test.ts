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
