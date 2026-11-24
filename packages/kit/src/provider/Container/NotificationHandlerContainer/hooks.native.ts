import { useCallback, useEffect, useRef } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import launchOptionsManager from '@onekeyhq/shared/src/modules/LaunchOptionsManager';
import type { INavigateToNotificationDetailParams } from '@onekeyhq/shared/src/utils/notificationsUtils';
import notificationsUtils from '@onekeyhq/shared/src/utils/notificationsUtils';
import type {
  IJPushRemotePushMessageInfo,
  INotificationPushMessageInfo,
} from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { isVersionCompatible } from '../../../hooks/useVersionCompatible';
import { whenAppUnlocked } from '../../../utils/passwordUtils';
import { isForceUpdateUiActive } from '../../../views/AppUpdate/hooks/useForceUpdateContactSupport';
import { ColdStartByNotification } from '../ColdStartByNotification';

export const useInitialNotification = () => {
  const coldStartRef = useRef(true);
  const handleShowNotificationDetail = useCallback(
    async (
      params: Omit<
        INavigateToNotificationDetailParams,
        'getEarnAccount' | 'localParams'
      >,
    ) => {
      await whenAppUnlocked();
      if (isForceUpdateUiActive()) return;
      const version = params.message?.extras?.miniBundlerVersion;
      if (!isVersionCompatible(version)) {
        appEventBus.emit(EAppEventBusNames.ShowFallbackUpdateDialog, {
          version,
        });
        return;
      }
      void notificationsUtils.navigateToNotificationDetail(params);
    },
    [],
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
