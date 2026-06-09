import { useCallback, useEffect, useRef } from 'react';

import launchOptionsManager from '@onekeyhq/shared/src/modules/LaunchOptionsManager';
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

// UNUserNotificationCenter delivers the launch tap asynchronously, with no
// ordering guarantee relative to JS boot. The native side buffers the tapped
// LOCAL-notification payload in an in-memory launch store (drained read-once);
// poll it for ~2s so a `didReceive` write that lands after JS starts is still
// picked up. Empty reads clear nothing, so the retries are harmless no-ops on a
// normal (non-notification) cold start.
const COLD_START_LOCAL_NOTIFICATION_MAX_ATTEMPTS = 8;
const COLD_START_LOCAL_NOTIFICATION_RETRY_MS = 250;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const drainColdStartLocalNotification =
  async (): Promise<INotificationPushMessageInfo | null> => {
    for (
      let attempt = 0;
      attempt < COLD_START_LOCAL_NOTIFICATION_MAX_ATTEMPTS;
      attempt += 1
    ) {
      const userInfo =
        await launchOptionsManager.getAndClearColdStartLocalNotification();
      if (userInfo) {
        return userInfo;
      }
      await delay(COLD_START_LOCAL_NOTIFICATION_RETRY_MS);
    }
    return null;
  };

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
      if (!isVersionCompatible(params.message?.extras?.miniBundlerVersion)) {
        return;
      }
      await whenAppUnlocked();
      void notificationsUtils.navigateToNotificationDetail(params);
    },
    [isVersionCompatible],
  );
  useEffect(() => {
    setTimeout(async () => {
      if (coldStartRef.current) {
        coldStartRef.current = false;
        const options: IJPushRemotePushMessageInfo | null =
          ColdStartByNotification.launchNotification;
        if (options) {
          console.log(
            'coldStart ColdStartByNotification launchNotification',
            options,
          );
          options.msgId =
            options?.params?.msgId ||
            options?.msgId ||
            options?._j_msgid?.toString() ||
            '';
          console.log(
            'coldStart ColdStartByNotification launchNotification FIXED',
            options,
          );
          const title = options.aps?.alert?.title || '';
          const content = options.aps?.alert?.body || '';
          const icon = options?.image;
          const badge = options.aps?.badge?.toString() || '';

          void backgroundApiProxy.serviceNotification.handleColdStartByNotification(
            {
              notificationId: options.msgId,
              params: {
                notificationId: options.msgId,
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
                  },
                },
              },
            },
          );
          return;
        }
        // Cold-start deep-link for LOCAL notifications (app was killed, user
        // tapped). Remote (APNs) cold start is handled above via
        // `ColdStartByNotification.launchNotification`; local notifications have
        // no such synchronous launch channel, so we drain the native buffer.
        const coldLocalUserInfo = await drainColdStartLocalNotification();
        if (coldLocalUserInfo) {
          await handleShowNotificationDetail({
            message: coldLocalUserInfo,
            notificationAccountId: coldLocalUserInfo?.extras?.params?.accountId,
            mode: coldLocalUserInfo?.extras?.mode,
            payload: coldLocalUserInfo?.extras?.payload,
            notificationId:
              coldLocalUserInfo?.extras?.params?.msgId ||
              coldLocalUserInfo?.extras?.msgId ||
              '',
          });
          return;
        }
        const launchOptions = await launchOptionsManager.getLaunchOptions();
        let userInfo: INotificationPushMessageInfo | undefined;
        if (launchOptions?.localNotification) {
          userInfo = launchOptions.localNotification.userInfo;
        } else if (launchOptions?.remoteNotification) {
          userInfo = launchOptions.remoteNotification.userInfo;
        }
        if (userInfo) {
          await handleShowNotificationDetail({
            message: userInfo,
            notificationAccountId: userInfo?.extras?.params?.accountId,
            mode: userInfo?.extras?.mode,
            payload: userInfo?.extras?.payload,
            notificationId:
              userInfo?.extras?.params?.msgId || userInfo?.extras?.msgId || '',
          });
        }
      }
    }, 350);
  }, [handleShowNotificationDetail]);
};
