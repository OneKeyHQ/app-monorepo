import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import launchOptionsManager from '@onekeyhq/shared/src/modules/LaunchOptionsManager';
import { ELaunchOptionsLaunchType } from '@onekeyhq/shared/src/modules/LaunchOptionsManager/type';
import type { INavigateToNotificationDetailParams } from '@onekeyhq/shared/src/utils/notificationsUtils';
import notificationsUtils from '@onekeyhq/shared/src/utils/notificationsUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { whenAppUnlocked } from '../../../utils/passwordUtils';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

export const useInitialNotification = (
  activeAccountRef: RefObject<IAccountSelectorActiveAccountInfo>,
) => {
  const coldStartRef = useRef(true);
  const handleShowNotificationDetail = useCallback(
    async (
      params: Omit<
        INavigateToNotificationDetailParams,
        'getEarnAccount' | 'localParams'
      >,
    ) => {
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
    [activeAccountRef],
  );
  useEffect(() => {
    setTimeout(async () => {
      if (coldStartRef.current) {
        coldStartRef.current = false;
        const launchOptions = await launchOptionsManager.getLaunchOptions();
        switch (launchOptions?.launchType) {
          case ELaunchOptionsLaunchType.localNotification:
            {
              // locationNotification exmaple
              // {
              //   "userInfo": {
              //       "extras": {
              //           "payload": "{\n  \"screen\": \"modal\",\n  \"params\": {\n      \"screen\": \"StakingModal\",\n      \"params\": {\n          \"screen\": \"ProtocolDetailsV2\",\n          \"params\": {\n              \"accountId\": \"{local_accountId}\",\n              \"networkId\": \"evm--1\",\n              \"indexedAccountId\": \"{local_indexedAccountId}\",\n              \"provider\": \"ethena\",\n              \"symbol\": \"USDe\"\n           }\n       }\n   }\n}",
              //           "msgId": "865b0498-7fd2-4dea-88b1-76cb34b6bc4b",
              //           "topic": "announcement",
              //           "params": {
              //               "createdAt": "2025-09-12T10:07:20.219Z",
              //               "instanceId": "de7cc9bd-d4fc-4718-88bc-16005a4263dc",
              //               "msgId": "865b0498-7fd2-4dea-88b1-76cb34b6bc4b",
              //               "announcementId": "272f9c01-a5fd-419a-94da-5bf394a30c08_1757585240229"
              //           },
              //           "mode": 1,
              //           "badge": 8
              //       },
              //       "content": "content",
              //       "title": "title",
              //       "messageID": "865b0498-7fd2-4dea-88b1-76cb34b6bc4b"
              //   },
              //   "fireDate": 1757585240.350214
              // }
              const localNotification = launchOptions?.localNotification;
              if (localNotification) {
                const { userInfo } = localNotification;
                if (userInfo) {
                  await handleShowNotificationDetail({
                    message: localNotification.userInfo,
                    notificationAccountId: userInfo?.extras?.params?.accountId,
                    mode: userInfo?.extras?.mode,
                    payload: userInfo?.extras?.payload,
                    notificationId:
                      userInfo?.extras?.params?.msgId ||
                      userInfo?.extras?.msgId ||
                      '',
                  });
                }
              }
            }
            break;
          case ELaunchOptionsLaunchType.remoteNotification:
            {
              const remoteNotification = launchOptions?.remoteNotification;
            }
            break;
          case ELaunchOptionsLaunchType.normal:
          default:
            break;
        }
      }
    }, 350);
  }, [activeAccountRef, handleShowNotificationDetail]);
};
