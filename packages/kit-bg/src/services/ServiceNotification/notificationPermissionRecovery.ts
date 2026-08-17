import type {
  INotificationPermissionDetail,
  INotificationPermissionRecoveryResult,
} from '@onekeyhq/shared/types/notification';
import {
  ENotificationPermission,
  ENotificationPermissionRecoveryReason,
} from '@onekeyhq/shared/types/notification';

export const NOTIFICATION_PERMISSION_RECOVERY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function buildNotificationPermissionRecoveryResult({
  checkedAt,
  dismissedAt,
  ignoreCooldown,
  isNative,
  isServerSettingsAvailable,
  isTestMode,
  permissionDetail,
  pushEnabled,
  queryFailed,
}: {
  checkedAt: number;
  dismissedAt: number | undefined;
  ignoreCooldown: boolean;
  isNative: boolean;
  isServerSettingsAvailable: boolean;
  isTestMode: boolean;
  permissionDetail: INotificationPermissionDetail | undefined;
  pushEnabled: boolean | undefined;
  queryFailed: boolean;
}): INotificationPermissionRecoveryResult {
  const buildResult = ({
    reason,
    shouldShow = false,
  }: {
    reason: ENotificationPermissionRecoveryReason;
    shouldShow?: boolean;
  }): INotificationPermissionRecoveryResult => ({
    checkedAt,
    isSupported: permissionDetail?.isSupported,
    isTestMode,
    permission: permissionDetail?.permission,
    pushEnabled,
    reason,
    shouldShow,
  });

  if (!isNative) {
    return buildResult({
      reason: ENotificationPermissionRecoveryReason.nonNative,
    });
  }

  if (queryFailed) {
    return buildResult({
      reason: ENotificationPermissionRecoveryReason.queryFailed,
    });
  }

  if (!isServerSettingsAvailable) {
    return buildResult({
      reason: ENotificationPermissionRecoveryReason.serverSettingsUnavailable,
    });
  }

  if (!pushEnabled) {
    return buildResult({
      reason: ENotificationPermissionRecoveryReason.pushDisabled,
    });
  }

  if (!permissionDetail?.isSupported) {
    return buildResult({
      reason: ENotificationPermissionRecoveryReason.permissionUnsupported,
    });
  }

  if (permissionDetail.permission === ENotificationPermission.granted) {
    return buildResult({
      reason: ENotificationPermissionRecoveryReason.permissionGranted,
    });
  }

  if (
    !ignoreCooldown &&
    dismissedAt &&
    checkedAt - dismissedAt < NOTIFICATION_PERMISSION_RECOVERY_COOLDOWN_MS
  ) {
    return buildResult({
      reason: ENotificationPermissionRecoveryReason.cooldown,
    });
  }

  return buildResult({
    reason: ENotificationPermissionRecoveryReason.permissionRequired,
    shouldShow: true,
  });
}
