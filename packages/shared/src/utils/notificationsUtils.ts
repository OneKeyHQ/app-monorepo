import { StackActions } from '@react-navigation/native';
import { isNil } from 'lodash';

import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';

import {
  ENotificationPermission,
  ENotificationPushMessageAckAction,
  ENotificationPushMessageMode,
} from '../../types/notification';
import appGlobals from '../appGlobals';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import platformEnv from '../platformEnv';
import { EModalAssetDetailRoutes, EModalRoutes } from '../routes';
import { EModalNotificationsRoutes } from '../routes/notifications';
import { ERootRoutes } from '../routes/root';

import extUtils from './extUtils';
import { openUrlExternal, openUrlInApp } from './openUrlUtils';
import { buildModalRouteParams } from './routeUtils';

import type { INotificationPushMessageInfo } from '../../types/notification';

function convertWebPermissionToEnum(
  permission: NotificationPermission,
): ENotificationPermission {
  switch (permission) {
    case 'default':
      return ENotificationPermission.default;
    case 'denied':
      return ENotificationPermission.denied;
    case 'granted':
      return ENotificationPermission.granted;
    default:
      return ENotificationPermission.default;
  }
}

export const NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED: true | false =
  false;
export const NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT = 20;

export function navigateToNotificationDetailByLocalParams({
  payload,
  localParams,
}: {
  payload: {
    screen: string;
    params: Record<string, any>;
  };
  localParams: Record<string, string | undefined>;
}) {
  const { screen, params: navigationParams } = payload;
  // Recursively find and merge the deepest params

  let targetParams = navigationParams;
  while (targetParams?.params && typeof targetParams.params === 'object') {
    targetParams = targetParams.params;
  }
  // Replace template variables in targetParams values with localParams values
  for (const [key, value] of Object.entries(targetParams)) {
    if (typeof value === 'string' && value.includes('{')) {
      targetParams[key] = value.replace(/\{local_(\w+)\}/g, (match, param) => {
        return localParams[param as keyof typeof localParams] || match;
      });
    }
  }
  appGlobals.$navigationRef.current?.navigate(screen, navigationParams);
  return true;
}

async function navigateToNotificationDetail({
  notificationId,
  notificationAccountId,
  message,
  isFromNotificationClick,
  navigation,
  mode,
  payload,
  localParams,
}: {
  notificationId: string;
  notificationAccountId?: string;
  message: INotificationPushMessageInfo | undefined;
  isFromNotificationClick?: boolean; // click by system notification banner
  navigation?: IAppNavigation;
  mode?: ENotificationPushMessageMode;
  payload?: string;
  localParams?: Record<string, string | undefined> | undefined;
}) {
  let routes: string[] = [];
  let params: any = {};
  let shouldAckRead = true;

  if (isFromNotificationClick) {
    routes = [
      ERootRoutes.Modal,
      EModalRoutes.NotificationsModal,
      EModalNotificationsRoutes.NotificationList,
    ];
  }

  // show Transaction Detail Modal
  if (message?.extras?.params?.transactionHash) {
    // ack readed after detail page opened
    shouldAckRead = false;
    routes = [
      ERootRoutes.Modal,
      EModalRoutes.MainModal,
      EModalAssetDetailRoutes.HistoryDetails,
    ];
    if (message?.extras?.params) {
      const { accountId, networkId, accountAddress, transactionHash } =
        message?.extras?.params || {};
      params = {
        accountId,
        networkId,
        accountAddress,
        transactionHash,
        notificationId,
        notificationAccountId,
        checkIsFocused: false,
        allowClickAccountNameSwitch: true,
      };
    }
  }

  const showFallbackUpdateDialog = () => {
    appEventBus.emit(EAppEventBusNames.ShowFallbackUpdateDialog, {
      version: message?.extras?.miniBundlerVersion,
    });
  };

  // For new versions with mode set, handle the mode properly
  if (!isFromNotificationClick) {
    if (shouldAckRead) {
      void appGlobals?.$backgroundApiProxy?.serviceNotification.ackNotificationMessage(
        {
          msgId: notificationId,
          action: ENotificationPushMessageAckAction.readed,
        },
      );
    }

    if (mode) {
      switch (mode) {
        case ENotificationPushMessageMode.page:
          try {
            const payloadObj = JSON.parse(payload || '');
            navigateToNotificationDetailByLocalParams({
              payload: payloadObj,
              localParams: localParams || {},
            });
          } catch (error) {
            showFallbackUpdateDialog();
          }
          break;
        case ENotificationPushMessageMode.dialog:
          try {
            const payloadObj = JSON.parse(payload || '');
            appEventBus.emit(
              EAppEventBusNames.ShowNotificationViewDialog,
              payloadObj,
            );
          } catch (error) {
            showFallbackUpdateDialog();
          }

          break;
        case ENotificationPushMessageMode.openInBrowser:
          if (payload) {
            openUrlExternal(payload);
          }
          break;
        case ENotificationPushMessageMode.openInApp:
          if (payload) {
            openUrlInApp(payload);
          }
          break;
        default:
          break;
      }
      return;
    }
  }

  // For backward compatibility with older versions:
  // If no specific mode is set, use default navigation behavior
  // - For extension background: open in expanded tab or side panel
  // - For other platforms: use modal navigation with route params
  // eslint-disable-next-line import/no-named-as-default-member, no-lonely-if

  if (routes.length === 0) {
    return;
  }

  if (platformEnv.isExtensionBackground) {
    // TODO not working for side panel
    await extUtils.openExpandTabOrSidePanel({
      routes,
      params,
    });
    // await chrome.tabs.create({
    //   url: `https://example.com?notificationId=`,
    // });
  } else {
    const modalParams = buildModalRouteParams({
      screens: routes,
      routeParams: params,
    });
    if (
      navigation &&
      routes?.length === 3 &&
      routes?.[0] === ERootRoutes.Modal
    ) {
      const [, screen1, screen2] = routes;
      navigation.pushModal(screen1 as any, {
        screen: screen2,
        params,
      });
    } else {
      const pushAction = StackActions.push(
        modalParams.screen,
        modalParams.params,
      );
      appGlobals.$navigationRef.current?.dispatch(pushAction);
    }
  }
}

function formatBadgeNumber(badgeNumber: number | undefined) {
  if (isNil(badgeNumber)) {
    return '';
  }
  if (!badgeNumber || badgeNumber <= 0) {
    return '';
  }
  if (badgeNumber > 99) {
    return '99+';
  }
  return badgeNumber.toString();
}

export default {
  convertWebPermissionToEnum,
  navigateToNotificationDetail,
  formatBadgeNumber,
};
