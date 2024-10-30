import { StackActions } from '@react-navigation/native';
import { isNil } from 'lodash';

import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';

import {
  ENotificationPermission,
  ENotificationPushMessageAckAction,
} from '../../types/notification';
import platformEnv from '../platformEnv';
import { EModalAssetDetailRoutes, EModalRoutes } from '../routes';
import { EModalNotificationsRoutes } from '../routes/notifications';
import { ERootRoutes } from '../routes/root';

import extUtils from './extUtils';
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

async function navigateToNotificationDetail({
  notificationId,
  message,
  isFromNotificationClick,
  navigation,
}: {
  notificationId: string;
  message: INotificationPushMessageInfo | undefined;
  isFromNotificationClick?: boolean; // click by system notification banner
  navigation?: IAppNavigation;
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
        checkIsFocused: false,
      };
    }
  }

  if (shouldAckRead) {
    void globalThis.$backgroundApiProxy.serviceNotification.ackNotificationMessage(
      {
        msgId: notificationId,
        action: ENotificationPushMessageAckAction.readed,
      },
    );
  }

  if (routes.length === 0) {
    return;
  }

  // eslint-disable-next-line import/no-named-as-default-member
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
      globalThis.$navigationRef.current?.dispatch(pushAction);
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
