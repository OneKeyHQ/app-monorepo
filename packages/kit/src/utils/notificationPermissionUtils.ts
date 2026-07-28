import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes/setting';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import type { IAppNavigation } from '../hooks/useAppNavigation';

// Notifications are considered "fully enabled" only when the OneKey master
// switch (pushEnabled) is on AND the system permission is granted. Either one
// missing means the user could silently miss feature push alerts.
export async function isNotificationFullyEnabled(): Promise<boolean> {
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

// Best-effort notification enablement shared by feature reminders (KYT dialog,
// export history banner). A failure here must not surface as an unhandled
// rejection or interrupt the caller's feature flow.
export async function enableNotificationsBestEffort({
  navigation,
}: {
  navigation: IAppNavigation;
}): Promise<void> {
  try {
    // 1) Turn on the OneKey notification master switch if it is off.
    const serverSettings =
      await backgroundApiProxy.serviceNotification.fetchServerNotificationSettingsWithCache();
    // `/notification/v1/config/update` replaces the entire config object
    // (NotificationsSettings always submits `{ ...currentSettings, ...part }`),
    // so we may only merge-submit when we already hold a complete server
    // settings object. When it is missing or empty (new user / empty server
    // config), spreading it would POST a bare `{ pushEnabled: true }` and
    // silently wipe other notification defaults (account activity, price
    // alerts, etc.). In that case mirror NotificationEnableAlert and route
    // to the notification SETTINGS page: it owns the master-switch
    // semantics for an empty config and chains into the OS-permission
    // guide on its own, whereas the guide page alone only requests the OS
    // permission and never enables the server-side pushEnabled switch.
    const hasServerSettings =
      !!serverSettings && Object.keys(serverSettings).length > 0;
    if (!hasServerSettings) {
      await timerUtils.wait(300);
      navigation.pushModal(EModalRoutes.SettingModal, {
        screen: EModalSettingRoutes.SettingNotifications,
      });
      return;
    }
    if (!serverSettings.pushEnabled) {
      await backgroundApiProxy.serviceNotification.updateServerNotificationSettings(
        {
          ...serverSettings,
          pushEnabled: true,
        },
      );
    }
    // 2) If the system permission is still missing, route to the existing
    // notification permission guide page. Wait for any in-progress dismiss
    // animation before pushing the modal, matching the NotificationsSettings
    // flow.
    const permission =
      await backgroundApiProxy.serviceNotification.getPermission();
    if (
      permission.isSupported &&
      permission.permission !== ENotificationPermission.granted
    ) {
      await timerUtils.wait(300);
      navigation.pushModal(EModalRoutes.NotificationsModal, {
        screen: EModalNotificationsRoutes.NotificationIntroduction,
      });
    }
  } catch {
    // Best-effort notification enablement; swallow failures.
  }
}
