import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

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

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

export const useInitialNotification = (
  activeAccountRef: RefObject<IAccountSelectorActiveAccountInfo>,
) => {
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
      const localParams = {
        accountId: activeAccountRef.current?.account?.id,
        indexedAccountId: activeAccountRef.current?.indexedAccount?.id,
        networkId: activeAccountRef.current?.network?.id,
        walletId: activeAccountRef.current?.wallet?.id,
        accountName: activeAccountRef.current?.account?.name,
        deriveType: activeAccountRef.current?.deriveType,
        avatarUrl: activeAccountRef.current?.wallet?.avatar,
      };
      void notificationsUtils.navigateToNotificationDetail({
        ...params,
        localParams,
        getEarnAccount: (props) =>
          backgroundApiProxy.serviceStaking.getEarnAccount(props),
      });
    },
    [activeAccountRef, isVersionCompatible],
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
  }, [activeAccountRef, handleShowNotificationDetail]);
};
