import { type IntlShape } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { type IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

// Notifications are considered "fully enabled" only when the OneKey master
// switch (pushEnabled) is on AND the system permission is granted. Either one
// missing means the user could silently miss KYT risk push alerts.
async function isNotificationFullyEnabled(): Promise<boolean> {
  // Web dapp mode has no push capability; mirror NotificationEnableAlert and skip.
  if (platformEnv.isWebDappMode) {
    return true;
  }
  const serverSettings =
    await backgroundApiProxy.serviceNotification.fetchServerNotificationSettingsWithCache();
  if (!serverSettings?.pushEnabled) {
    return false;
  }
  const permission =
    await backgroundApiProxy.serviceNotification.getPermission();
  if (
    permission.isSupported &&
    permission.permission !== ENotificationPermission.granted
  ) {
    return false;
  }
  return true;
}

// Prompt the user to enable notifications after KYT (receive risk monitoring)
// is turned on. KYT detection keeps working regardless; this only ensures the
// user can receive timely high-risk push alerts. No-op when notifications are
// already fully enabled.
export async function promptKytNotificationPermissionIfNeeded({
  navigation,
  intl,
}: {
  navigation: IAppNavigation;
  intl: IntlShape;
}): Promise<void> {
  if (await isNotificationFullyEnabled()) {
    return;
  }
  Dialog.show({
    icon: 'BellOutline',
    title: intl.formatMessage({
      id: ETranslations.notifications_intro_title,
    }),
    description: intl.formatMessage({
      id: ETranslations.kyt_receive_risk_monitoring_notification_permission__desc,
    }),
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_enable,
    }),
    onCancelText: intl.formatMessage({
      id: ETranslations.global_later,
    }),
    onConfirm: async ({ close }) => {
      await close();
      // 1) Turn on the OneKey notification master switch if it is off.
      const serverSettings =
        await backgroundApiProxy.serviceNotification.fetchServerNotificationSettingsWithCache();
      if (!serverSettings?.pushEnabled) {
        await backgroundApiProxy.serviceNotification.updateServerNotificationSettings(
          {
            ...serverSettings,
            pushEnabled: true,
          },
        );
      }
      // 2) If the system permission is still missing, route to the existing
      // notification permission guide page.
      const permission =
        await backgroundApiProxy.serviceNotification.getPermission();
      if (
        permission.isSupported &&
        permission.permission !== ENotificationPermission.granted
      ) {
        // Wait for the dialog dismiss animation before pushing the modal,
        // matching the existing NotificationsSettings flow.
        await timerUtils.wait(300);
        navigation.pushModal(EModalRoutes.NotificationsModal, {
          screen: EModalNotificationsRoutes.NotificationIntroduction,
        });
      }
    },
  });
}
