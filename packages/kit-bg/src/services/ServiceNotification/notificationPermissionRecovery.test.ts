import {
  ENotificationPermission,
  ENotificationPermissionRecoveryReason,
} from '@onekeyhq/shared/types/notification';

import {
  NOTIFICATION_PERMISSION_RECOVERY_COOLDOWN_MS,
  buildNotificationPermissionRecoveryResult,
  buildNotificationPermissionRecoveryStateTransition,
  resolveNotificationPermissionRecoveryLastPermission,
} from './notificationPermissionRecovery';

const checkedAt = 1_000_000;

function buildResult(
  overrides: Partial<
    Parameters<typeof buildNotificationPermissionRecoveryResult>[0]
  > = {},
) {
  return buildNotificationPermissionRecoveryResult({
    checkedAt,
    dismissedAt: undefined,
    ignoreCooldown: false,
    isNative: true,
    isServerSettingsAvailable: true,
    isTestMode: false,
    permissionDetail: {
      isSupported: true,
      permission: ENotificationPermission.default,
    },
    pushEnabled: true,
    queryFailed: false,
    ...overrides,
  });
}

describe('buildNotificationPermissionRecoveryResult', () => {
  it('shows recovery when push is enabled but native permission is missing', () => {
    expect(buildResult()).toMatchObject({
      reason: ENotificationPermissionRecoveryReason.permissionRequired,
      shouldShow: true,
    });
    expect(
      buildResult({
        permissionDetail: {
          isSupported: true,
          permission: ENotificationPermission.denied,
        },
      }),
    ).toMatchObject({
      reason: ENotificationPermissionRecoveryReason.permissionRequired,
      shouldShow: true,
    });
  });

  it.each([
    {
      expected: ENotificationPermissionRecoveryReason.pushDisabled,
      overrides: { pushEnabled: false },
    },
    {
      expected: ENotificationPermissionRecoveryReason.permissionGranted,
      overrides: {
        permissionDetail: {
          isSupported: true,
          permission: ENotificationPermission.granted,
        },
      },
    },
    {
      expected: ENotificationPermissionRecoveryReason.permissionUnsupported,
      overrides: {
        permissionDetail: {
          isSupported: false,
          permission: ENotificationPermission.default,
        },
      },
    },
    {
      expected: ENotificationPermissionRecoveryReason.serverSettingsUnavailable,
      overrides: { isServerSettingsAvailable: false },
    },
    {
      expected: ENotificationPermissionRecoveryReason.queryFailed,
      overrides: { queryFailed: true },
    },
    {
      expected: ENotificationPermissionRecoveryReason.nonNative,
      overrides: { isNative: false },
    },
  ])('does not show for $expected', ({ expected, overrides }) => {
    expect(buildResult(overrides)).toMatchObject({
      reason: expected,
      shouldShow: false,
    });
  });

  it('honors and can bypass the dismissal cooldown', () => {
    const dismissedAt =
      checkedAt - NOTIFICATION_PERMISSION_RECOVERY_COOLDOWN_MS;

    expect(buildResult({ dismissedAt: dismissedAt + 1 })).toMatchObject({
      reason: ENotificationPermissionRecoveryReason.cooldown,
      shouldShow: false,
    });
    expect(buildResult({ dismissedAt })).toMatchObject({
      reason: ENotificationPermissionRecoveryReason.permissionRequired,
      shouldShow: true,
    });
    expect(
      buildResult({ dismissedAt: dismissedAt + 1, ignoreCooldown: true }),
    ).toMatchObject({
      reason: ENotificationPermissionRecoveryReason.permissionRequired,
      shouldShow: true,
    });
  });
});

describe('buildNotificationPermissionRecoveryStateTransition', () => {
  it('clears the cooldown and registers after permission is restored', () => {
    expect(
      buildNotificationPermissionRecoveryStateTransition({
        currentPermission: ENotificationPermission.granted,
        dismissedAt: checkedAt,
        isTestMode: false,
        previousPermission: ENotificationPermission.denied,
        pushEnabled: true,
      }),
    ).toEqual({
      dismissedAtForCheck: undefined,
      nextDismissedAt: undefined,
      shouldRegisterClient: true,
    });
  });

  it('keeps the cooldown when the missing permission is unchanged', () => {
    expect(
      buildNotificationPermissionRecoveryStateTransition({
        currentPermission: ENotificationPermission.denied,
        dismissedAt: checkedAt,
        isTestMode: false,
        previousPermission: ENotificationPermission.denied,
        pushEnabled: true,
      }),
    ).toEqual({
      dismissedAtForCheck: checkedAt,
      nextDismissedAt: checkedAt,
      shouldRegisterClient: false,
    });
  });

  it.each([
    {
      isTestMode: true,
      pushEnabled: true,
    },
    {
      isTestMode: false,
      pushEnabled: false,
    },
  ])(
    'does not register for $isTestMode test mode with pushEnabled=$pushEnabled',
    ({ isTestMode, pushEnabled }) => {
      expect(
        buildNotificationPermissionRecoveryStateTransition({
          currentPermission: ENotificationPermission.granted,
          dismissedAt: checkedAt,
          isTestMode,
          previousPermission: ENotificationPermission.denied,
          pushEnabled,
        }).shouldRegisterClient,
      ).toBe(false);
    },
  );
});

describe('resolveNotificationPermissionRecoveryLastPermission', () => {
  it('commits granted only after registration succeeds', () => {
    expect(
      resolveNotificationPermissionRecoveryLastPermission({
        currentPermission: ENotificationPermission.granted,
        previousPermission: ENotificationPermission.denied,
        registrationFailed: false,
      }),
    ).toBe(ENotificationPermission.granted);
    expect(
      resolveNotificationPermissionRecoveryLastPermission({
        currentPermission: ENotificationPermission.granted,
        previousPermission: ENotificationPermission.denied,
        registrationFailed: true,
      }),
    ).toBe(ENotificationPermission.denied);
  });
});
