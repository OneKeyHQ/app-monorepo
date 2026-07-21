import {
  buildPro2DeviceMetaState,
  canEditPro2DeviceWideSettings,
  getPro2DeviceMetaStaticOverrides,
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
  it('uses normalized Features for session state and preferences', () => {
    expect(
      buildPro2DeviceMetaState({
        isVerified: true,
        features: {
          unlocked: true,
          initialized: true,
          backupRequired: true,
          passphraseProtection: true,
          attachToPinEnabled: true,
          unlockedAttachPin: true,
          language: 'ja-JP',
          brightness: 60,
          autoLockDelayMs: 60_000,
          autoShutdownDelayMs: 300_000,
          hapticFeedback: true,
        },
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
        features: {
          unlocked: false,
          passphraseProtection: false,
          attachToPinEnabled: false,
        },
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

describe('getPro2DeviceMetaStaticOverrides', () => {
  it('uses DeviceInfo only for immutable firmware metadata', () => {
    expect(
      getPro2DeviceMetaStaticOverrides({
        info: {
          protocol_version: 1,
          fw: { application: { version: '2.1.0' } },
          coprocessor: { bt_adv_name: 'Pro2 FDD5' },
        },
      }),
    ).toEqual({
      firmwareVersion: '2.1.0',
    });
  });
});
