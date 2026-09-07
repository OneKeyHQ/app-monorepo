import {
  buildTravelModeCurrencyReferenceView,
  buildTravelModeManualLockPersistView,
  buildTravelModePasswordPersistView,
  buildTravelModeSettingsPersistView,
  mergeTravelModeManualLockPersistWrite,
  mergeTravelModePasswordPersistWrite,
  mergeTravelModeSettingsPersistWrite,
} from './persistencePolicy';

describe('Travel Mode password and lock persistence policy', () => {
  const persistedValue = {
    appLockDuration: 15,
    enablePasswordErrorProtection: true,
    enableSystemIdleLock: false,
    isPasscodeModeFixed: true,
    isPasswordSet: true,
    passwordErrorAttempts: 2,
    passwordErrorProtectionTime: 100,
    passwordMode: 'passcode',
    webAuthCredentialId: 'private-web-auth-id',
  };
  const initialValue = {
    appLockDuration: 100_000_000_000_000,
    enablePasswordErrorProtection: false,
    enableSystemIdleLock: true,
    isPasscodeModeFixed: undefined,
    isPasswordSet: false,
    passwordErrorAttempts: 0,
    passwordErrorProtectionTime: 0,
    passwordMode: 'password',
    webAuthCredentialId: '',
  };

  it('exposes existing auto-lock settings without exposing password secrets', () => {
    expect(
      buildTravelModePasswordPersistView({
        initialValue,
        persistedValue,
      }),
    ).toEqual({
      ...initialValue,
      appLockDuration: 15,
      enableSystemIdleLock: false,
      isPasscodeModeFixed: true,
      isPasswordSet: true,
      passwordErrorAttempts: 2,
      passwordErrorProtectionTime: 100,
      passwordMode: 'passcode',
    });
  });

  it('persists auto-lock settings and brute-force state', () => {
    expect(
      mergeTravelModePasswordPersistWrite({
        persistedValue,
        proposedValue: {
          ...persistedValue,
          appLockDuration: 30,
          enableSystemIdleLock: true,
          passwordErrorAttempts: 3,
          passwordErrorProtectionTime: 200,
        },
      }),
    ).toEqual({
      ...persistedValue,
      appLockDuration: 30,
      enableSystemIdleLock: true,
      passwordErrorAttempts: 3,
      passwordErrorProtectionTime: 200,
    });
  });

  it('exposes and persists only the manual-lock boolean', () => {
    expect(
      buildTravelModeManualLockPersistView({
        initialValue: { manualLocking: false },
        persistedValue: {
          manualLocking: true,
          privateField: 'hidden',
        },
      }),
    ).toEqual({ manualLocking: true });
    expect(
      mergeTravelModeManualLockPersistWrite({
        persistedValue: {
          manualLocking: true,
          privateField: 'hidden',
        },
        proposedValue: {
          manualLocking: false,
          privateField: 'replacement',
        },
      }),
    ).toEqual({ manualLocking: false });
  });

  it('ignores malformed manual-lock values', () => {
    expect(
      buildTravelModeManualLockPersistView({
        initialValue: { manualLocking: false },
        persistedValue: { manualLocking: 'yes' },
      }),
    ).toEqual({ manualLocking: false });
    expect(
      mergeTravelModeManualLockPersistWrite({
        persistedValue: { manualLocking: true, privateField: 'hidden' },
        proposedValue: { manualLocking: 'no' },
      }),
    ).toEqual({ manualLocking: true });
  });
});

describe('Travel Mode settings persistence policy', () => {
  const initialValue = {
    currencyInfo: { id: 'usd', symbol: '$' },
    hapticFeedbackEnabled: true,
    instanceId: 'fresh-instance',
    locale: 'system',
    sensitiveEncodeKey: 'fresh-key',
    theme: 'system',
  };

  it('projects only the four supported preferences over fresh defaults', () => {
    expect(
      buildTravelModeSettingsPersistView({
        initialValue,
        persistedValue: {
          currencyInfo: { id: 'eur', symbol: '€' },
          hapticFeedbackEnabled: false,
          instanceId: 'real-instance',
          locale: 'zh-CN',
          sensitiveEncodeKey: 'real-key',
          theme: 'dark',
        },
      }),
    ).toEqual({
      currencyInfo: { id: 'eur', symbol: '€' },
      hapticFeedbackEnabled: false,
      instanceId: 'fresh-instance',
      locale: 'zh-CN',
      sensitiveEncodeKey: 'fresh-key',
      theme: 'dark',
    });
  });

  it('merges only supported preference writes into the real record', () => {
    expect(
      mergeTravelModeSettingsPersistWrite({
        persistedValue: {
          ...initialValue,
          instanceId: 'real-instance',
          sensitiveEncodeKey: 'real-key',
        },
        proposedValue: {
          currencyInfo: { id: 'jpy', symbol: '¥' },
          hapticFeedbackEnabled: false,
          instanceId: 'attacker-instance',
          locale: 'ja-JP',
          sensitiveEncodeKey: 'attacker-key',
          theme: 'light',
        },
      }),
    ).toEqual({
      currencyInfo: { id: 'jpy', symbol: '¥' },
      hapticFeedbackEnabled: false,
      instanceId: 'real-instance',
      locale: 'ja-JP',
      sensitiveEncodeKey: 'real-key',
      theme: 'light',
    });
  });

  it('ignores malformed supported fields', () => {
    expect(
      mergeTravelModeSettingsPersistWrite({
        persistedValue: initialValue,
        proposedValue: {
          currencyInfo: { id: '', symbol: '$' },
          hapticFeedbackEnabled: 'yes',
          locale: 'not-a-locale',
          theme: 'midnight',
        },
      }),
    ).toEqual(initialValue);
  });

  it('exposes cached currency choices without other persisted atom fields', () => {
    expect(
      buildTravelModeCurrencyReferenceView({
        initialValue: { currencyMap: {} },
        persistedValue: {
          currencyMap: {
            usd: { id: 'usd', name: 'US Dollar', type: ['fiat'], unit: '$' },
          },
          privateField: 'hidden',
        },
      }),
    ).toEqual({
      currencyMap: {
        usd: { id: 'usd', name: 'US Dollar', type: ['fiat'], unit: '$' },
      },
    });
  });
});
