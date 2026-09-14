import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  type IOsNotificationPermissionAction,
  canSendOsNotificationTest,
  getOsNotificationPermissionSafe,
  isOsNotificationPermissionPending,
  recoverOsNotificationPermission,
  resolveOsNotificationPermissionAction,
} from '@onekeyhq/kit/src/utils/notificationPermissionUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

const NOTIFICATION_HELPER_CTA_TITLE: Record<
  IOsNotificationPermissionAction,
  ETranslations
> = {
  none: ETranslations.global_test,
  request: ETranslations.global_enable,
  openSettings: ETranslations.global_go_to_settings,
};

export function useNotificationHelperCta() {
  const intl = useIntl();
  const [isBusy, setIsBusy] = useState(false);
  const {
    result: permission,
    isLoading,
    run,
  } = usePromiseResult(getOsNotificationPermissionSafe, [], {
    watchLoading: true,
    // Do not wait for route focus: a lagging focus flag would leave the
    // CTA spinning instead of settling on Enable / Settings / Test.
    checkIsFocused: false,
  });

  const reloadPermission = useCallback(() => {
    void run();
  }, [run]);
  const isNativeIOS = !!platformEnv.isNativeIOS;
  useHandleAppStateActive(isNativeIOS ? reloadPermission : undefined);

  const isFocused = useRouteIsFocused();
  const wasFocusedRef = useRef(isFocused);
  useEffect(() => {
    const wasFocused = wasFocusedRef.current;
    wasFocusedRef.current = isFocused;
    if (isNativeIOS && isFocused && !wasFocused) {
      reloadPermission();
    }
  }, [isFocused, isNativeIOS, reloadPermission]);

  const isPending = isOsNotificationPermissionPending({
    permission,
    isLoading,
    isNativeIOS,
  });
  const action = resolveOsNotificationPermissionAction({
    permission,
    isNativeIOS,
  });

  const sendTestNotification = useCallback(async () => {
    await backgroundApiProxy.serviceNotification.showNotification({
      title: intl.formatMessage({
        id: ETranslations.notifications_test_message_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.notifications_test_message_desc,
      }),
    });
  }, [intl]);

  const handlePress = useCallback(async () => {
    if (isPending) {
      return;
    }
    setIsBusy(true);
    try {
      if (action === 'none') {
        const allowed = await canSendOsNotificationTest();
        reloadPermission();
        if (allowed) {
          await sendTestNotification();
        }
        return;
      }
      const recovered = await recoverOsNotificationPermission();
      reloadPermission();
      // After a first-time Allow, send the preview immediately so the user
      // does not have to hunt for a second Test tap.
      if (recovered?.permission === ENotificationPermission.granted) {
        await sendTestNotification();
      }
    } catch {
      // Preview/test send is best-effort; keep the CTA usable.
    } finally {
      setIsBusy(false);
    }
  }, [action, isPending, reloadPermission, sendTestNotification]);

  return { action, isBusy, isPending, handlePress };
}

export type INotificationHelperCta = ReturnType<
  typeof useNotificationHelperCta
>;

export function NotificationHelperCtaButton({
  cta,
  loading: restLoading,
  ...rest
}: IButtonProps & { cta: INotificationHelperCta }) {
  const intl = useIntl();
  const { action, isBusy, isPending, handlePress } = cta;
  const isPermissionCta = isPending || action !== 'none';

  return (
    <Button
      {...rest}
      testID={
        isPermissionCta
          ? 'setting-notification-permission-btn'
          : 'setting-intl-btn'
      }
      loading={isBusy || isPending || restLoading}
      onPress={() => {
        void handlePress();
      }}
    >
      {isPending
        ? ''
        : intl.formatMessage({ id: NOTIFICATION_HELPER_CTA_TITLE[action] })}
    </Button>
  );
}

function NotificationsTestButton(props: IButtonProps) {
  const cta = useNotificationHelperCta();
  return <NotificationHelperCtaButton {...props} cta={cta} />;
}

export default NotificationsTestButton;
