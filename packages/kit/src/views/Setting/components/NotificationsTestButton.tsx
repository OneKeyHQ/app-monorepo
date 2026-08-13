import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, YStack } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

type INotificationsTestButtonProps = IButtonProps & {
  showPermissionAction?: boolean;
};

function NotificationsTestButton({
  disabled,
  showPermissionAction = false,
  ...rest
}: INotificationsTestButtonProps) {
  const intl = useIntl();
  const isMountedRef = useIsMounted();
  const [permission, setPermission] = useState(ENotificationPermission.default);
  const [isPermissionActionLoading, setIsPermissionActionLoading] =
    useState(false);

  const refreshPermission = useCallback(async () => {
    if (!showPermissionAction) {
      return;
    }
    try {
      const result =
        await backgroundApiProxy.serviceNotification.getPermissionWithoutLog();
      if (isMountedRef.current) {
        setPermission(result.permission);
      }
    } catch {
      // Keep the recovery action available when the permission state cannot be read.
    }
  }, [isMountedRef, showPermissionAction]);

  useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  const handleAppActive = useCallback(() => {
    void refreshPermission();
  }, [refreshPermission]);
  useHandleAppStateActive(showPermissionAction ? handleAppActive : undefined);

  const handlePermissionAction = useCallback(async () => {
    if (!showPermissionAction || isPermissionActionLoading) {
      return;
    }
    setIsPermissionActionLoading(true);
    try {
      if (permission === ENotificationPermission.denied) {
        await backgroundApiProxy.serviceNotification.openPermissionSettings();
      } else {
        const result =
          await backgroundApiProxy.serviceNotification.requestPermission();
        if (isMountedRef.current) {
          setPermission(result.permission);
        }
      }
    } catch {
      await refreshPermission();
    } finally {
      if (isMountedRef.current) {
        setIsPermissionActionLoading(false);
      }
    }
  }, [
    isMountedRef,
    isPermissionActionLoading,
    permission,
    refreshPermission,
    showPermissionAction,
  ]);

  const shouldShowPermissionAction =
    showPermissionAction && permission !== ENotificationPermission.granted;
  const testButton = (
    <Button
      testID="setting-intl-btn"
      disabled={disabled || shouldShowPermissionAction}
      onPress={() => {
        void backgroundApiProxy.serviceNotification.showNotification({
          title: intl.formatMessage({
            id: ETranslations.notifications_test_message_title,
          }),
          description: intl.formatMessage({
            id: ETranslations.notifications_test_message_desc,
          }),
        });
      }}
      {...rest}
    >
      {intl.formatMessage({ id: ETranslations.global_test })}
    </Button>
  );

  if (!showPermissionAction) {
    return testButton;
  }

  return (
    <YStack gap="$2" alignItems="flex-end">
      {shouldShowPermissionAction ? (
        <Button
          testID="notification-permission-action-btn"
          loading={isPermissionActionLoading}
          size={rest.size}
          onPress={() => {
            void handlePermissionAction();
          }}
        >
          {intl.formatMessage({
            id:
              permission === ENotificationPermission.denied
                ? ETranslations.global_go_to_settings
                : ETranslations.global_enable,
          })}
        </Button>
      ) : null}
      {testButton}
    </YStack>
  );
}

export default NotificationsTestButton;
