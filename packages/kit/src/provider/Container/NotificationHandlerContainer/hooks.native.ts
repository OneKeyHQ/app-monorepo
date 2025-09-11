import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import launchOptionsManager from '@onekeyhq/shared/src/modules/LaunchOptionsManager';
import type { INavigateToNotificationDetailParams } from '@onekeyhq/shared/src/utils/notificationsUtils';
import notificationsUtils from '@onekeyhq/shared/src/utils/notificationsUtils';
import type { INotificationPushMessageInfo } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useVersionCompatible } from '../../../hooks/useVersionCompatible';
import { whenAppUnlocked } from '../../../utils/passwordUtils';

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
