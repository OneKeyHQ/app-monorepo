import { useCallback, useEffect, useRef } from 'react';

import launchOptionsManager from '@onekeyhq/shared/src/modules/LaunchOptionsManager';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import type { INavigateToNotificationDetailParams } from '@onekeyhq/shared/src/utils/notificationsUtils';
import notificationsUtils from '@onekeyhq/shared/src/utils/notificationsUtils';
import type {
  IJPushRemotePushMessageInfo,
  INotificationPushMessageInfo,
} from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useVersionCompatible } from '../../../hooks/useVersionCompatible';
import { whenAppUnlocked } from '../../../utils/passwordUtils';
import { ColdStartByNotification } from '../ColdStartByNotification';

export const useInitialNotification = () => {
  const coldStartRef = useRef(true);
  const { isVersionCompatible } = useVersionCompatible();
  const handleShowNotificationDetail = useCallback(
    async (
      params: Omit<
        INavigateToNotificationDetailParams,
        'getEarnAccount' | 'localParams'
      >,
    ) => {
      if (
        travelModeManager.isMaskingDataSync() ||
        !isVersionCompatible(params.message?.extras?.miniBundlerVersion)
      ) {
        return;
      }
      await whenAppUnlocked();
      if (!travelModeManager.isMaskingDataSync()) {
        void notificationsUtils.navigateToNotificationDetail(params);
      }
    },
    [isVersionCompatible],
  );
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (coldStartRef.current && !travelModeManager.isMaskingDataSync()) {
        coldStartRef.current = false;
        const options: IJPushRemotePushMessageInfo | null =
          ColdStartByNotification.launchNotification;
        if (options) {
          ColdStartByNotification.launchNotification = null;
          const notificationId =
            options.params?.msgId ||
            options.msgId ||
            options._j_msgid?.toString() ||
            '';
          const title = options.aps?.alert?.title || '';
          const content = options.aps?.alert?.body || '';
          const icon = options?.image;
          const badge = options.aps?.badge?.toString() || '';

          void backgroundApiProxy.serviceNotification.handleColdStartByNotification(
            {
              notificationId,
              params: {
                notificationId,
                title,
                description: content,
                icon,
                remotePushMessageInfo: {
                  pushSource: 'jpush',
                  title,
                  content,
                  badge,
                  extras: {
                    ...options,
                    msgId: notificationId,
                  },
                },
              },
            },
          );
          return;
        }
        const localNotification =
          ColdStartByNotification.localLaunchNotification;
        ColdStartByNotification.localLaunchNotification = null;
        let userInfo: INotificationPushMessageInfo | undefined | null =
          localNotification;
        if (!userInfo) {
          const launchOptions = await launchOptionsManager.getLaunchOptions();
          userInfo =
            launchOptions?.localNotification?.userInfo ??
            launchOptions?.remoteNotification?.userInfo;
        }
        if (userInfo) {
          await handleShowNotificationDetail({
            message: userInfo,
            isFromNotificationClick: true,
            notificationAccountId: userInfo?.extras?.params?.accountId,
            mode: userInfo?.extras?.mode,
            payload: userInfo?.extras?.payload,
            notificationId:
              userInfo?.extras?.params?.msgId ||
              userInfo?.extras?.msgId ||
              localNotification?.notificationId ||
              '',
          });
        }
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [handleShowNotificationDetail]);
};
