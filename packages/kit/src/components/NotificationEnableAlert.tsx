import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

import { usePromiseResult } from '../hooks/usePromiseResult';

function BasicNotificationEnableAlert() {
  const intl = useIntl();
  const [{ historyAlertDismissed }, setNotificationsData] =
    useNotificationsAtom();

  const { result } = usePromiseResult(async () => {
    // Only check on supported platforms
    if (platformEnv.isWebDappMode) {
      return {
        shouldShow: false,
      };
    }

    const [permission, serverSettings] = await Promise.all([
      backgroundApiProxy.serviceNotification.getPermission(),
      backgroundApiProxy.serviceNotification.fetchServerNotificationSettingsWithCache(),
    ]);

    const isPushEnabled = !!serverSettings?.pushEnabled;
    const isPermissionGranted =
      permission.isSupported &&
      permission.permission === ENotificationPermission.granted;

    // Show alert if push is disabled OR permission is not granted
    const shouldShow = !isPushEnabled || !isPermissionGranted;

    return {
      shouldShow,
      isPushEnabled,
      isPermissionGranted,
    };
  }, []);

  const handleClose = useCallback(() => {
    setNotificationsData((v) => ({
      ...v,
      historyAlertDismissed: true,
    }));
  }, [setNotificationsData]);

  const shouldShowAlert = useMemo(
    () => !historyAlertDismissed && result?.shouldShow,
    [historyAlertDismissed, result?.shouldShow],
  );

  if (!shouldShowAlert) {
    return null;
  }

  return (
    <Stack px="$2" pb="$2">
      <Alert
        type="info"
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.global_wallet_history_notification_banner,
        })}
        closable
        onClose={handleClose}
      />
    </Stack>
  );
}

export const NotificationEnableAlert = memo(BasicNotificationEnableAlert);
