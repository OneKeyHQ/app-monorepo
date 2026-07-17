import {
  buildPro2DeviceMetaState,
  getPro2DeviceMetaStaticOverrides,
} from './pro2DeviceManagement';

describe('buildPro2DeviceMetaState', () => {
  it('uses DeviceStatus for session state and DeviceSettings for preferences', () => {
    expect(
      buildPro2DeviceMetaState({
        isVerified: true,
        snapshot: {
          status: {
            unlocked: true,
            passphrase_enabled: true,
            attach_to_pin_enabled: true,
          },
          settings: {
            language: 'ja-JP',
            // cspell:disable-next-line
            autolock_delay_ms: 60_000,
            // cspell:disable-next-line
            autoshutdown_delay_ms: 300_000,
            haptic_feedback: true,
          },
        },
      }),
    ).toEqual({
      isVerified: true,
      unlocked: true,
      passphraseEnabled: true,
      pinOnAppEnabled: true,
      autoLockDelayMs: 60_000,
      autoShutDownDelayMs: 300_000,
      language: 'ja-JP',
      hapticFeedback: true,
      isReady: true,
    });
  });

  it('does not require DeviceSettings while the device is locked', () => {
    expect(
      buildPro2DeviceMetaState({
        isVerified: false,
        snapshot: {
          status: {
            unlocked: false,
            passphrase_enabled: false,
            attach_to_pin_enabled: false,
          },
        },
      }),
    ).toEqual({
      isVerified: false,
      unlocked: false,
      passphraseEnabled: false,
      pinOnAppEnabled: false,
      autoLockDelayMs: undefined,
      autoShutDownDelayMs: undefined,
      language: undefined,
      hapticFeedback: false,
      isReady: true,
    });
  });
});

describe('getPro2DeviceMetaStaticOverrides', () => {
  it('uses DeviceInfo for the device name and firmware version', () => {
    expect(
      getPro2DeviceMetaStaticOverrides({
        status: {},
        info: {
          protocol_version: 1,
          fw: { application: { version: '2.1.0' } },
          coprocessor: { bt_adv_name: 'Pro2 FDD5' },
        },
      }),
    ).toEqual({
      deviceName: 'Pro2 FDD5',
      firmwareVersion: '2.1.0',
    });
  });
});
