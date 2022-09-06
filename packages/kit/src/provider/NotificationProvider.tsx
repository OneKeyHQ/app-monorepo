import React, { memo, useCallback, useEffect } from 'react';

import { requestPermissionsAsync } from 'expo-notifications';
import JPush from 'jpush-react-native';
import { AppState } from 'react-native';

import { DialogManager } from '@onekeyhq/components';
import {
  EVMDecodedItem,
  EVMDecodedTxType,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import {
  useActiveWalletAccount,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import {
  HomeRoutes,
  RootRoutes,
  TabRoutes,
} from '@onekeyhq/kit/src/routes/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import {
  checkPushNotificationPermission,
  hasPermission,
  initJpush,
} from '@onekeyhq/shared/src/notification';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import PermissionDialog from '../components/PermissionDialog/PermissionDialog';
import { setPushNotificationConfig } from '../store/reducers/settings';
import { setHomeTabName } from '../store/reducers/status';
import { useWalletsAndAccounts } from '../views/PushNotification/hooks';
import { WalletHomeTabEnum } from '../views/Wallet/type';

import { navigationRef } from './NavigationProvider';

export type NotificationResult = {
  messageID: string;
  title: string;
  content: string;
  badge?: string;
  ring?: string;
  extras: Record<string, string>;
  notificationEventType: 'notificationArrived' | 'notificationOpened';
};

export type SwitchScreenParams = {
  screen: HomeRoutes.ScreenTokenDetail | HomeRoutes.InitialTab;
  params: {
    accountAddress?: string;
    networkId?: string;
    tokenId?: string;
    initialTabName?: string;
  };
};

const NotificationProvider: React.FC<{
  children: React.ReactElement<any, any> | null;
}> = ({ children }) => {
  const { pushNotification } = useSettings();
  const { getWalletsAndAccounts } = useWalletsAndAccounts();
  const { accountId, networkId } = useActiveWalletAccount();

  const { engine, dispatch, serviceAccount, serviceNetwork } =
    backgroundApiProxy;

  const switchAccountAndNetwork = useCallback(
    async (params: SwitchScreenParams['params']) => {
      if (params.accountAddress) {
        const wallets = await getWalletsAndAccounts();
        for (const w of wallets) {
          for (const account of w.accounts) {
            if (account.address === params.accountAddress) {
              debugLogger.notification.info(
                `switch account, accountId=${account.id}`,
              );
              await serviceAccount.changeActiveAccount({
                accountId: account.id,
                walletId: w.id,
              });
              break;
            }
          }
        }
      }
      if (params.networkId) {
        debugLogger.notification.info(
          `switch network, network=${params.networkId}`,
        );
        await serviceNetwork.changeActiveNetwork(params.networkId);
      }
    },
    [serviceNetwork, serviceAccount, getWalletsAndAccounts],
  );

  const switchToScreen = useCallback(
    async ({ screen, params }: SwitchScreenParams) => {
      try {
        await switchAccountAndNetwork(params);
        switch (screen) {
          case HomeRoutes.ScreenTokenDetail:
            {
              const filter = params.tokenId
                ? undefined
                : (i: EVMDecodedItem) =>
                  i.txType === EVMDecodedTxType.NATIVE_TRANSFER;
              navigationRef.current?.navigate(RootRoutes.Root, {
                screen,
                params: {
                  accountId,
                  networkId: params.networkId || networkId,
                  tokenId: params.tokenId || '',
                  historyFilter: filter,
                },
              });
            }
            break;
          case HomeRoutes.InitialTab:
            navigationRef.current?.navigate(RootRoutes.Root, {
              screen: HomeRoutes.InitialTab,
              params: {
                screen: RootRoutes.Tab,
                params: {
                  screen: TabRoutes.Home,
                },
              } as any,
            });
            dispatch(setHomeTabName(WalletHomeTabEnum.History));
            break;
          default:
            break;
        }
      } catch (error) {
        debugLogger.notification.error(
          'Jpush navigate error',
          error instanceof Error ? error.message : error,
        );
      }
    },
    [accountId, networkId, switchAccountAndNetwork, dispatch],
  );

  const clearJpushBadge = useCallback(() => {
    debugLogger.notification.debug('clearJpushBadge');
    JPush.setBadge({
      badge: 0,
      appBadge: 0,
    });
  }, []);

  const handleNotificaitonCallback = useCallback(
    (result: NotificationResult) => {
      debugLogger.notification.debug('JPUSH.notificationListener', result);
      if (result?.notificationEventType !== 'notificationArrived') {
        clearJpushBadge();
      }
      if (!accountId || !networkId) {
        return;
      }
      if (
        result?.notificationEventType !== 'notificationOpened' ||
        !result.extras
      ) {
        return;
      }
      const extras = result?.extras as {
        screen: SwitchScreenParams['screen'];
        params: string;
      };
      if (!extras.screen) {
        return;
      }
      let params: SwitchScreenParams['params'] = {};
      try {
        params = platformEnv.isNativeIOS
          ? extras.params
          : JSON.parse(extras.params);
      } catch (error) {
        debugLogger.notification.error(
          `Jpush parse params error`,
          error instanceof Error ? error.message : error,
        );
      }
      switchToScreen({
        screen: extras.screen,
        params,
      });
    },
    [switchToScreen, clearJpushBadge, accountId, networkId],
  );

  const handleLocalNotificationCallback = useCallback(
    (result: NotificationResult) => {
      handleNotificaitonCallback(result);
    },
    [handleNotificaitonCallback],
  );

  const handleRegistrationIdCallback = useCallback(
    (res: { registerID: string }) => {
      debugLogger.notification.debug('JPUSH.getRegistrationID', res);
      dispatch(
        setPushNotificationConfig({
          registrationId: res.registerID,
        }),
      );
      engine.syncPushNotificationConfig();
    },
    [dispatch, engine],
  );

  const handleConnectStateChangeCallback = useCallback(
    (result: { connectEnable: boolean }) => {
      debugLogger.notification.debug('JPUSH.addConnectEventListener', result);
      if (!result.connectEnable) {
        return;
      }
      JPush.getRegistrationID(handleRegistrationIdCallback);
    },
    [handleRegistrationIdCallback],
  );

  const checkPermission = useCallback(async () => {
    if (!pushNotification?.pushEnable) {
      return false;
    }
    const alreadyHasPermission = await checkPushNotificationPermission();
    if (alreadyHasPermission) {
      return true;
    }
    dispatch(
      setPushNotificationConfig({
        pushEnable: false,
      }),
    );
    DialogManager.show({
      render: <PermissionDialog type="notification" />,
    });
    return false;
  }, [dispatch, pushNotification?.pushEnable]);

  const handlePushEnableChange = useCallback(async () => {
    const permission = await requestPermissionsAsync();
    if (!hasPermission(permission)) {
      return checkPermission();
    }
    return true;
  }, [checkPermission]);

  const checkPermissionAndInit = useCallback(async () => {
    const enabled = await handlePushEnableChange();
    engine.syncPushNotificationConfig();
    if (!enabled) {
      return;
    }
    initJpush();
    JPush.getRegistrationID(handleRegistrationIdCallback);
  }, [engine, handleRegistrationIdCallback, handlePushEnableChange]);

  useEffect(() => {
    if (!platformEnv.isNative) {
      return;
    }
    JPush.removeListener(handleNotificaitonCallback);
    JPush.removeListener(handleConnectStateChangeCallback);
    JPush.removeListener(handleLocalNotificationCallback);
    JPush.addConnectEventListener(handleConnectStateChangeCallback);
    JPush.addNotificationListener(handleNotificaitonCallback);
    JPush.addLocalNotificationListener(handleLocalNotificationCallback);
  }, [
    handleNotificaitonCallback,
    handleLocalNotificationCallback,
    handleConnectStateChangeCallback,
  ]);

  useEffect(() => {
    if (pushNotification?.pushEnable) {
      checkPermissionAndInit();
    }
  }, [pushNotification?.pushEnable, checkPermissionAndInit]);

  useEffect(() => {
    if (!platformEnv.isNative) {
      return;
    }
    clearJpushBadge();
    const listener = AppState.addEventListener('change', (state) => {
      if (!['background', 'inactive'].includes(state)) {
        clearJpushBadge();
        checkPermission();
      }
    });
    return () => {
      listener.remove();
    };
  }, [checkPermission, clearJpushBadge]);

  return children;
};

NotificationProvider.displayName = 'NotificationProvider';

export default memo(NotificationProvider);
