import React, { memo, useCallback, useEffect, useRef } from 'react';

import JPush from 'jpush-react-native';

import {
  useActiveWalletAccount,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import { HomeRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { JPUSH_CHANNEL, JPUSH_KEY } from '../config';
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
  const jpushInitRef = useRef<boolean>(false);
  const { pushNotification, devMode } = useSettings();

  const switchToScreen = useCallback(
    ({ screen, params }: SwitchScreenParams) => {
      if (params.networkId) {
        backgroundApiProxy.serviceNetwork.changeActiveNetwork(params.networkId);
      }
      try {
        navigationRef.current?.navigate(RootRoutes.Root, {
          screen,
          params: {
            accountId,
            networkId: params.networkId || networkId,
            tokenId: params.tokenId || '',
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

  const handleNotificaitonCallback = useCallback(
    (result: NotificationResult) => {
      // clear badge
      JPush.setBadge({
        badge: 0,
        appBadge: 0,
      });
      debugLogger.common.debug('JPUSH.notificationListener', result);
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
    [switchToScreen],
  );

  const initJpush = useCallback(() => {
    const config = {
      'appKey': JPUSH_KEY,
      'titchannelle': JPUSH_CHANNEL,
      'production': !devMode?.enableTestFiatEndpoint,
    };
    debugLogger.common.debug(`JPUSH:init`, config);
    // clear badges
    JPush.setBadge({
      badge: 0,
      appBadge: 0,
    });
    JPush.init(config);
    JPush.getRegistrationID((res) => {
      debugLogger.common.debug('JPUSH.getRegistrationID', res);
      backgroundApiProxy.dispatch(
        setPushNotificationConfig({
          registrationId: res.registerID,
        }),
      );
    });
    JPush.addConnectEventListener((result) => {
      debugLogger.common.debug('JPUSH.addConnectEventListener', result);
      if (!result.connectEnable) {
        return;
      }
      JPush.getRegistrationID((res) => {
        debugLogger.common.debug('JPUSH.getRegistrationID', res);
        backgroundApiProxy.dispatch(
          setPushNotificationConfig({
            registrationId: res.registerID,
          }),
        );
      });
    });
    JPush.addNotificationListener(handleNotificaitonCallback);
    JPush.addLocalNotificationListener(handleNotificaitonCallback);
  }, [handleNotificaitonCallback, devMode?.enableTestFiatEndpoint]);

  useEffect(() => {
    if (jpushInitRef.current) {
      return;
    }
    if (!platformEnv.isNative) {
      return;
    }
    if (!accountId || !networkId) {
      return;
    }
    if (!pushNotification.pushEnable) {
      return;
    }
    jpushInitRef.current = true;
    initJpush();
  }, [initJpush, accountId, networkId, pushNotification?.pushEnable]);

  return children;
};

NotificationProvider.displayName = 'NotificationProvider';

export default memo(NotificationProvider);
