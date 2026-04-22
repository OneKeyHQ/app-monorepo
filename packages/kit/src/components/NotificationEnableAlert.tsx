import { memo, useCallback, useMemo } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { Alert, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes/setting';

import useAppNavigation from '../hooks/useAppNavigation';
import { usePromiseResult } from '../hooks/usePromiseResult';

export type INotificationAlertScene =
  | 'txHistory'
  | 'swapHistory'
  | 'perpHistory';

const dismissedKeyMap: Record<
  INotificationAlertScene,
  | 'txHistoryAlertDismissed'
  | 'swapHistoryAlertDismissed'
  | 'perpHistoryAlertDismissed'
> = {
  txHistory: 'txHistoryAlertDismissed',
  swapHistory: 'swapHistoryAlertDismissed',
  perpHistory: 'perpHistoryAlertDismissed',
};

const i18nKeyMap: Record<INotificationAlertScene, ETranslations> = {
  txHistory: ETranslations.global_wallet_history_notification_banner,
  swapHistory: ETranslations.global_swap_history_notification_banner,
  perpHistory: ETranslations.global_perp_history_notification_banner,
};

function BasicNotificationEnableAlert({
  scene,
}: {
  scene: INotificationAlertScene;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [notificationsData, setNotificationsData] = useNotificationsAtom();

  const dismissedKey = dismissedKeyMap[scene];
  const isDismissed = notificationsData[dismissedKey];
  const { lastSettingsUpdateTime } = notificationsData;

  const { result } = usePromiseResult(async () => {
    if (platformEnv.isWebDappMode) {
      return {
        shouldShow: false,
      };
    }

    noop(lastSettingsUpdateTime);

    const serverSettings =
      await backgroundApiProxy.serviceNotification.fetchServerNotificationSettingsWithCache();

    // If serverSettings is undefined (API failed), don't show the alert
    if (!serverSettings) {
      return {
        shouldShow: false,
      };
    }

    const shouldShow = !serverSettings.pushEnabled;

    return {
      shouldShow,
    };
  }, [lastSettingsUpdateTime]);

  const handleClose = useCallback(() => {
    setNotificationsData((v) => ({
      ...v,
      [dismissedKey]: true,
    }));
  }, [setNotificationsData, dismissedKey]);

  const handleEnablePress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingNotifications,
    });
  }, [navigation]);

  const alertAction = useMemo(
    () => ({
      primary: intl.formatMessage({ id: ETranslations.global_enable }),
      onPrimaryPress: handleEnablePress,
    }),
    [intl, handleEnablePress],
  );

  const shouldShowAlert = useMemo(
    () => !isDismissed && result?.shouldShow,
    [isDismissed, result?.shouldShow],
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
          id: i18nKeyMap[scene],
        })}
        closable
        onClose={handleClose}
        action={alertAction}
      />
    </Stack>
  );
}

export const NotificationEnableAlert = memo(BasicNotificationEnableAlert);
