import {
  buildPro2DeviceMetaState,
  canEditPro2DeviceWideSettings,
  getPro2DeviceMetaStaticData,
  resolvePro2DeviceState,
  shouldRefreshDeviceSettingsAfterUpdate,
} from './pro2DeviceManagement';

describe('canEditPro2DeviceWideSettings', () => {
  it('keeps device-wide settings editable while Pro 2 is locked', () => {
    expect(canEditPro2DeviceWideSettings({ unlocked: false })).toBe(true);
  });
});

describe('shouldRefreshDeviceSettingsAfterUpdate', () => {
  it('does not refresh unreadable settings after a locked Pro 2 update', () => {
    expect(
      shouldRefreshDeviceSettingsAfterUpdate({
        isPro2: true,
        unlocked: false,
      }),
    ).toBe(false);
  });

  it('refreshes settings when Pro 2 is already unlocked', () => {
    expect(
      shouldRefreshDeviceSettingsAfterUpdate({
        isPro2: true,
        unlocked: true,
      }),
    ).toBe(true);
  });
});

describe('buildPro2DeviceMetaState', () => {
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
      initialized: false,
      backupRequired: false,
      unlockedByAttachToPin: false,
      passphraseEnabled: false,
      pinOnAppEnabled: false,
      autoLockDelayMs: undefined,
      autoShutDownDelayMs: undefined,
      language: undefined,
      brightness: undefined,
      hapticFeedback: false,
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
