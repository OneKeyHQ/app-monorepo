import {
  buildPro2DeviceMetaState,
  canEditPro2DeviceWideSettings,
  getPro2DeviceMetaStaticData,
  getPro2SnapshotFromDeviceStateEvent,
  resolvePro2DeviceState,
} from './pro2DeviceManagement';

describe('getPro2SnapshotFromDeviceStateEvent', () => {
  it('uses a matching state event as the newest Pro2 snapshot', () => {
    const state = {
      identity: { serialNo: 'PRO2_SERIAL', label: 'Renamed Pro 2' },
    };

    expect(
      getPro2SnapshotFromDeviceStateEvent({
        device: {
          deviceType: 'pro2',
          connectId: 'PRO2_USB',
          uuid: 'PRO2_SERIAL',
        },
        event: {
          connectId: 'PRO2_BLE',
          state,
        },
      } as never),
    ).toEqual({ state });
  });
});

describe('canEditPro2DeviceWideSettings', () => {
  it('keeps device-wide settings editable while Pro 2 is locked', () => {
    expect(canEditPro2DeviceWideSettings({ unlocked: false })).toBe(true);
  });
});

describe('buildPro2DeviceMetaState', () => {
  it('preserves unknown runtime status instead of treating it as false', () => {
    expect(
      buildPro2DeviceMetaState({
        isVerified: false,
        state: {
          status: {
            unlocked: null,
            initialized: null,
            backupRequired: null,
            unlockedAttachPin: null,
            passphraseProtection: null,
            attachToPinEnabled: null,
          },
          settings: { hapticFeedback: null },
        } as never,
      }),
    ).toMatchObject({
      unlocked: undefined,
      initialized: undefined,
      backupRequired: undefined,
      unlockedByAttachToPin: undefined,
      passphraseEnabled: undefined,
      pinOnAppEnabled: undefined,
      hapticFeedback: undefined,
      isReady: true,
    });
  });

  it('uses canonical state sections for session state and preferences', () => {
    expect(
      buildPro2DeviceMetaState({
        isVerified: true,
        state: {
          status: {
            unlocked: true,
            initialized: true,
            backupRequired: true,
            passphraseProtection: true,
            attachToPinEnabled: true,
            unlockedAttachPin: true,
          },
          settings: {
            language: 'ja-JP',
            brightness: 60,
            autoLockDelayMs: 60_000,
            autoShutdownDelayMs: 300_000,
            hapticFeedback: true,
          },
        } as never,
      }),
    ).toEqual({
      isVerified: true,
      unlocked: true,
      initialized: true,
      backupRequired: true,
      unlockedByAttachToPin: true,
      passphraseEnabled: true,
      pinOnAppEnabled: true,
      autoLockDelayMs: 60_000,
      autoShutDownDelayMs: 300_000,
      language: 'ja-JP',
      brightness: 60,
      hapticFeedback: true,
      isReady: true,
    });
  });

  it('does not require DeviceSettings while the device is locked', () => {
    expect(
      buildPro2DeviceMetaState({
        isVerified: false,
        state: {
          status: {
            unlocked: false,
            passphraseProtection: false,
            attachToPinEnabled: false,
          },
          settings: {},
        } as never,
      }),
    ).toEqual({
      isVerified: false,
      unlocked: false,
      initialized: undefined,
      backupRequired: undefined,
      unlockedByAttachToPin: undefined,
      passphraseEnabled: false,
      pinOnAppEnabled: false,
      autoLockDelayMs: undefined,
      autoShutDownDelayMs: undefined,
      language: undefined,
      brightness: undefined,
      hapticFeedback: undefined,
      isReady: true,
    });
  });
});

describe('getPro2DeviceMetaStaticData', () => {
  it('builds Pro2 static metadata without legacy features', () => {
    expect(
      getPro2DeviceMetaStaticData({
        identity: {
          displayName: 'My Pro 2',
          deviceType: 'pro2',
          firmwareType: 'universal',
        },
        versions: { firmware: '2.1.0' },
      } as never),
    ).toEqual({
      deviceName: 'My Pro 2',
      deviceType: 'pro2',
      firmwareType: 'universal',
      firmwareVersion: '2.1.0',
    });
  });

  it('keeps an unavailable firmware version unknown instead of fabricating 0.0.0', () => {
    expect(
      getPro2DeviceMetaStaticData({
        identity: {
          displayName: 'My Pro 2',
          deviceType: 'pro2',
          firmwareType: 'universal',
        },
        versions: {},
      } as never),
    ).toMatchObject({
      firmwareVersion: undefined,
    });
  });
});

describe('resolvePro2DeviceState', () => {
  it('prefers the freshly loaded snapshot over persisted state', () => {
    const persistedState = { revision: 1 };
    const snapshotState = { revision: 2 };

    expect(
      resolvePro2DeviceState({
        persistedState,
        snapshot: { state: snapshotState },
      } as never),
    ).toBe(snapshotState);
  });
});
