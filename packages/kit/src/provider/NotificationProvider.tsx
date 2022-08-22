import React, { memo, useCallback, useEffect, useMemo } from 'react';

import JPush from 'jpush-react-native';
import { AppState } from 'react-native';

import {
  EVMDecodedItem,
  EVMDecodedTxType,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import {
  useActiveWalletAccount,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import { HomeRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { initJpush } from '@onekeyhq/shared/src/notification';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { setPushNotificationConfig } from '../store/reducers/settings';

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
  screen: HomeRoutes.ScreenTokenDetail;
  params: {
    networkId?: string;
    tokenId?: string;
  };
};

const NotificationProvider: React.FC<{
  children: React.ReactElement<any, any> | null;
}> = ({ children }) => {
  const { accountId, networkId } = useActiveWalletAccount();
  const { pushNotification } = useSettings();

  const switchToScreen = useCallback(
    ({ screen, params }: SwitchScreenParams) => {
      if (params.networkId) {
        backgroundApiProxy.serviceNetwork.changeActiveNetwork(params.networkId);
      }

      const filter = params.tokenId
        ? undefined
        : (i: EVMDecodedItem) => i.txType === EVMDecodedTxType.NATIVE_TRANSFER;
      try {
        navigationRef.current?.navigate(RootRoutes.Root, {
          screen,
          params: {
            accountId,
            networkId: params.networkId || networkId,
            tokenId: params.tokenId || '',
            historyFilter: filter,
          },
        });
      } catch (error) {
        debugLogger.common.error(
          'Jpush navigate error',
          error instanceof Error ? error.message : error,
        );
      }
    },
    [accountId, networkId],
  );

  const clearJpushBadge = useCallback(() => {
    debugLogger.common.debug('clearJpushBadge');
    JPush.setBadge({
      badge: 0,
      appBadge: 0,
    });
  }, []);

  const handleNotificaitonCallback = useCallback(
    (result: NotificationResult) => {
      debugLogger.common.debug('JPUSH.notificationListener', result);
      if (result?.notificationEventType !== 'notificationArrived') {
        clearJpushBadge();
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
        debugLogger.common.error(
          `Jpush parse params error`,
          error instanceof Error ? error.message : error,
        );
      }
      switchToScreen({
        screen: extras.screen,
        params,
      });
    },
    [switchToScreen, clearJpushBadge],
  );

  const handleLocalNotificationCallback = useCallback(
    (result: NotificationResult) => {
      handleNotificaitonCallback(result);
    },
    [handleNotificaitonCallback],
  );

  const handleRegistrationIdCallback = useCallback(
    (res: { registerID: string }) => {
      debugLogger.common.debug('JPUSH.getRegistrationID', res);
      backgroundApiProxy.dispatch(
        setPushNotificationConfig({
          registrationId: res.registerID,
        }),
      );
      backgroundApiProxy.engine.syncPushNotificationConfig();
    },
    [],
  );

  const handleConnectStateChangeCallback = useCallback(
    (result: { connectEnable: boolean }) => {
      debugLogger.common.debug('JPUSH.addConnectEventListener', result);
      if (!result.connectEnable) {
        return;
      }
      JPush.getRegistrationID(handleRegistrationIdCallback);
    },
    [handleRegistrationIdCallback],
  );

  const shouldInitJpushListener = useMemo(() => {
    if (!accountId || !networkId) {
      return false;
    }
    if (!pushNotification?.pushEnable) {
      return false;
    }
    return true;
  }, [accountId, networkId, pushNotification?.pushEnable]);

  useEffect(() => {
    if (!platformEnv.isNative) {
      return;
    }
    clearJpushBadge();
    const listener = AppState.addEventListener('change', (state) => {
      if (!['background', 'inactive'].includes(state)) {
        clearJpushBadge();
      }
    });
    const clear = () => {
      listener.remove();
      JPush.removeListener(handleNotificaitonCallback);
      JPush.removeListener(handleConnectStateChangeCallback);
      JPush.removeListener(handleLocalNotificationCallback);
    };
    if (!shouldInitJpushListener) {
      return clear();
    }
    initJpush();
    backgroundApiProxy.engine.syncPushNotificationConfig();
    JPush.getRegistrationID(handleRegistrationIdCallback);
    JPush.addConnectEventListener(handleConnectStateChangeCallback);
    JPush.addNotificationListener(handleNotificaitonCallback);
    JPush.addLocalNotificationListener(handleLocalNotificationCallback);
    return clear;
  }, [
    clearJpushBadge,
    shouldInitJpushListener,
    handleNotificaitonCallback,
    handleRegistrationIdCallback,
    handleLocalNotificationCallback,
    handleConnectStateChangeCallback,
  ]);

  return children;
};

NotificationProvider.displayName = 'NotificationProvider';

export default memo(NotificationProvider);
