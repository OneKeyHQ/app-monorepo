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
  pushEnabled,
}: INotificationPermissionRecoveryAlertProps) {
  const intl = useIntl();
  const isFocused = useRouteIsFocused();
  const [result, setResult] = useState<INotificationPermissionRecoveryResult>();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const requestSequenceRef = useRef(0);
  const isMountedRef = useRef(false);

  const clearPendingCheck = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const invalidatePendingCheck = useCallback(() => {
    requestSequenceRef.current += 1;
    clearPendingCheck();
  }, [clearPendingCheck]);

  const checkPermissionRecovery = useCallback(
    async ({
      ignoreCooldown = scene === 'settings',
      source,
    }: {
      ignoreCooldown?: boolean;
      source: ENotificationPermissionRecoverySource;
    }) => {
      const requestSequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestSequence;
      try {
        const nextResult =
          await backgroundApiProxy.serviceNotification.checkNotificationPermissionRecovery(
            {
              ignoreCooldown,
              pushEnabled,
              source,
            },
          );
        if (requestSequence !== requestSequenceRef.current) {
          return undefined;
        }
        setResult(nextResult);
        return nextResult;
      } catch {
        if (requestSequence !== requestSequenceRef.current) {
          return undefined;
        }
        setResult(undefined);
        return undefined;
      }
    },
    [pushEnabled, scene],
  );

  const scheduleCheck = useCallback(
    ({
      delayMs,
      source,
    }: {
      delayMs: number;
      source: ENotificationPermissionRecoverySource;
    }) => {
      invalidatePendingCheck();
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = undefined;
        void checkPermissionRecovery({ source });
      }, delayMs);
    },
    [checkPermissionRecovery, invalidatePendingCheck],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isFocused) {
      invalidatePendingCheck();
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
    return invalidatePendingCheck;
  }, [initialDelayMs, invalidatePendingCheck, isFocused, scene, scheduleCheck]);

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
    invalidatePendingCheck();
    setResult(undefined);
    void backgroundApiProxy.serviceNotification
      .dismissNotificationPermissionRecovery()
      .catch(() => undefined);
  }, [invalidatePendingCheck]);

  const handleRecovery = useCallback(async () => {
    invalidatePendingCheck();
    const actionSequence = requestSequenceRef.current;
    try {
      setIsActionLoading(true);
      await backgroundApiProxy.serviceNotification.recoverNotificationPermission();
      await timerUtils.wait(300);
      if (
        actionSequence !== requestSequenceRef.current ||
        !isMountedRef.current
      ) {
        return;
      }
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
      if (isMountedRef.current) {
        setIsActionLoading(false);
      }
    }
  }, [checkPermissionRecovery, invalidatePendingCheck, scene]);

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
