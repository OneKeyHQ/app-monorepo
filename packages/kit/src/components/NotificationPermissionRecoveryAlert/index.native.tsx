import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INotificationPermissionRecoveryResult } from '@onekeyhq/shared/types/notification';
import {
  ENotificationPermission,
  ENotificationPermissionRecoverySource,
} from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useHandleAppStateActive } from '../../hooks/useHandleAppStateActive';
import { useRouteIsFocused } from '../../hooks/useRouteIsFocused';

import type { INotificationPermissionRecoveryAlertProps } from './types';

const FOREGROUND_CHECK_DELAY_MS = 500;

function BasicNotificationPermissionRecoveryAlert({
  scene,
  initialDelayMs = 0,
}: INotificationPermissionRecoveryAlertProps) {
  const intl = useIntl();
  const isFocused = useRouteIsFocused();
  const [result, setResult] = useState<INotificationPermissionRecoveryResult>();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const clearPendingCheck = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const checkPermissionRecovery = useCallback(
    async ({
      ignoreCooldown = scene === 'settings',
      source,
    }: {
      ignoreCooldown?: boolean;
      source: ENotificationPermissionRecoverySource;
    }) => {
      try {
        const nextResult =
          await backgroundApiProxy.serviceNotification.checkNotificationPermissionRecovery(
            {
              ignoreCooldown,
              source,
            },
          );
        setResult(nextResult);
        return nextResult;
      } catch {
        setResult(undefined);
        return undefined;
      }
    },
    [scene],
  );

  const scheduleCheck = useCallback(
    ({
      delayMs,
      source,
    }: {
      delayMs: number;
      source: ENotificationPermissionRecoverySource;
    }) => {
      clearPendingCheck();
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = undefined;
        void checkPermissionRecovery({ source });
      }, delayMs);
    },
    [checkPermissionRecovery, clearPendingCheck],
  );

  useEffect(() => {
    if (!isFocused) {
      clearPendingCheck();
      setResult(undefined);
      return undefined;
    }
    scheduleCheck({
      delayMs: initialDelayMs,
      source:
        scene === 'home'
          ? ENotificationPermissionRecoverySource.homeStartup
          : ENotificationPermissionRecoverySource.settings,
    });
    return clearPendingCheck;
  }, [clearPendingCheck, initialDelayMs, isFocused, scene, scheduleCheck]);

  const handleAppActive = useCallback(() => {
    if (isFocused) {
      scheduleCheck({
        delayMs: FOREGROUND_CHECK_DELAY_MS,
        source: ENotificationPermissionRecoverySource.appActive,
      });
    }
  }, [isFocused, scheduleCheck]);
  const appActiveHandlers = useMemo(
    () => ({ onActiveFromBlur: handleAppActive }),
    [handleAppActive],
  );
  useHandleAppStateActive(handleAppActive, appActiveHandlers);

  const handleClose = useCallback(() => {
    setResult(undefined);
    void backgroundApiProxy.serviceNotification
      .dismissNotificationPermissionRecovery()
      .catch(() => undefined);
  }, []);

  const handleRecovery = useCallback(async () => {
    try {
      setIsActionLoading(true);
      await backgroundApiProxy.serviceNotification.recoverNotificationPermission();
      await timerUtils.wait(300);
      await checkPermissionRecovery({
        ignoreCooldown: true,
        source:
          scene === 'home'
            ? ENotificationPermissionRecoverySource.homeStartup
            : ENotificationPermissionRecoverySource.settings,
      });
    } catch {
      // The background method already displays the user-facing error toast.
    } finally {
      setIsActionLoading(false);
    }
  }, [checkPermissionRecovery, scene]);

  if (!result?.shouldShow) {
    return null;
  }

  const isPermissionDenied =
    result.permission === ENotificationPermission.denied;

  return (
    <Stack
      testID="notification-permission-recovery-alert"
      pt="$2"
      px="$pagePadding"
      bg="$bgApp"
    >
      <Alert
        type="info"
        icon="BellOutline"
        title={intl.formatMessage({
          id: ETranslations.notifications_intro_title,
        })}
        closable={scene === 'home'}
        onClose={handleClose}
        action={{
          isPrimaryLoading: isActionLoading,
          primary: intl.formatMessage({
            id: isPermissionDenied
              ? ETranslations.backup_go_system_settings
              : ETranslations.global_enable,
          }),
          primaryTestID: 'notification-permission-recovery-enable',
          onPrimaryPress: () => {
            void handleRecovery();
          },
        }}
      />
    </Stack>
  );
}

export const NotificationPermissionRecoveryAlert = memo(
  BasicNotificationPermissionRecoveryAlert,
);
