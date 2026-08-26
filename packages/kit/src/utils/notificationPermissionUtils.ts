import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes/setting';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  ENotificationPermission,
  type INotificationPermissionDetail,
} from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import type { IAppNavigation } from '../hooks/useAppNavigation';

export type IOsNotificationPermissionAction =
  | 'none'
  | 'request'
  | 'openSettings';

// iOS shows the system prompt only the first time requestAuthorization runs
// (status still notDetermined). After a deny, the prompt never returns and
// Settings is the only recovery path. Desktop always reports `default`, so
// never treat it as a missing OS grant.
export function resolveOsNotificationPermissionAction({
  permission,
  isDesktop,
  isWebDappMode,
}: {
  permission: INotificationPermissionDetail | undefined;
  isDesktop: boolean;
  isWebDappMode: boolean;
}): IOsNotificationPermissionAction {
  if (isWebDappMode || isDesktop) {
    return 'none';
  }
  if (!permission?.isSupported) {
    return 'none';
  }
  if (permission.permission === ENotificationPermission.granted) {
    return 'none';
  }
  if (permission.permission === ENotificationPermission.denied) {
    return 'openSettings';
  }
  return 'request';
}

// Native/extension first paint has `permission === undefined`. Treating that
// as `'none'` flashes Test before Enable / Go to Settings. Stay pending until
// the read finishes (`isLoading === false`) or a payload arrives. Desktop and
// web dapp always show Test, so they skip the wait.
export function isOsNotificationPermissionPending({
  permission,
  isLoading,
  isDesktop,
  isWebDappMode,
}: {
  permission: INotificationPermissionDetail | undefined;
  isLoading: boolean | undefined;
  isDesktop: boolean;
  isWebDappMode: boolean;
}): boolean {
  if (isWebDappMode || isDesktop) {
    return false;
  }
  return permission === undefined && isLoading !== false;
}

export async function getOsNotificationPermissionSafe(): Promise<
  INotificationPermissionDetail | undefined
> {
  try {
    return await backgroundApiProxy.serviceNotification.getPermissionWithoutLog();
  } catch {
    // Native/provider permission reads can throw when the module is unavailable.
    return undefined;
  }
}

function currentOsPermissionAction(
  permission: INotificationPermissionDetail | undefined,
): IOsNotificationPermissionAction {
  return resolveOsNotificationPermissionAction({
    permission,
    isDesktop: !!platformEnv.isDesktop,
    isWebDappMode: !!platformEnv.isWebDappMode,
  });
}

// Do not reuse enableNotificationPermissions() here: after a fresh deny it
// immediately opens Settings. notDetermined should only requestAuthorization.
export async function recoverOsNotificationPermission(
  knownPermission?: INotificationPermissionDetail,
): Promise<INotificationPermissionDetail | undefined> {
  const permission =
    knownPermission ?? (await getOsNotificationPermissionSafe());
  const action = currentOsPermissionAction(permission);
  if (action === 'none') {
    return permission;
  }
  try {
    if (action === 'request') {
      return await backgroundApiProxy.serviceNotification.requestPermission();
    }
    await backgroundApiProxy.serviceNotification.openPermissionSettings();
    return await getOsNotificationPermissionSafe();
  } catch {
    // requestPermission / openPermissionSettings can throw from the native module.
    return permission;
  }
}

export async function canSendOsNotificationTest(): Promise<boolean> {
  const permission = await getOsNotificationPermissionSafe();
  if (currentOsPermissionAction(permission) === 'none') {
    return true;
  }
  const recovered = await recoverOsNotificationPermission(permission);
  return recovered?.permission === ENotificationPermission.granted;
}

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
  // The desktop provider cannot resolve the real OS permission (neither the
  // main nor the render process reports it reliably, so it hardcodes
  // `default`; see NotificationProvider.desktop.ts). Gating on it there would
  // keep this check false forever, so the master switch alone decides on
  // desktop; other platforms report a real value and keep the gate.
  if (platformEnv.isDesktop) {
    return true;
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
    // notification permission guide page. Desktop cannot resolve the real OS
    // permission (see isNotificationFullyEnabled above), so the gate would
    // stay open forever and push the guide on every enable; the master
    // switch alone decides there. Wait for any in-progress dismiss
    // animation before pushing the modal, matching the NotificationsSettings
    // flow.
    if (platformEnv.isDesktop) {
      return;
    }
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
