import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import {
  DefaultTheme,
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import JPush from 'jpush-react-native';
import { RootSiblingParent } from 'react-native-root-siblings';

import { useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';
import {
  useActiveWalletAccount,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import RootStack from '@onekeyhq/kit/src/routes/Root';
import {
  HomeRoutes,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { analyticLogEvent } from '@onekeyhq/shared/src/analytics';
import { setAttributes } from '@onekeyhq/shared/src/crashlytics';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import linking from '../routes/linking';
import { setPushNotificationConfig } from '../store/reducers/settings';

import { useAutoNavigateOnMount } from './useAutoNavigateOnMount';

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

export type RootNavContainerRef = NavigationContainerRef<RootRoutesParams>;
export const navigationRef = React.createRef<RootNavContainerRef>();

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var $navigationRef: typeof navigationRef;
}

// update navigationRef.current at <NavigationContainer />
global.$navigationRef = navigationRef;

const NavigationApp = () => {
  useAutoNavigateOnMount();
  const { accountId, networkId } = useActiveWalletAccount();
  const routeNameRef = useRef<string>();
  const jpushInitRef = useRef<boolean>(false);
  const isVerticalLayout = useIsVerticalLayout();
  const [bgColor, textColor, dividerColor] = useThemeValue([
    'surface-subdued',
    'text-default',
    'divider',
  ]);

  /**
   * native-android & vertical layout web or ext
   */
  const showFixedBg =
    platformEnv.isNativeAndroid ||
    (isVerticalLayout && (platformEnv.isWeb || platformEnv.isExtension));

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: showFixedBg ? bgColor : 'transparent',
        card: bgColor,
        text: textColor,
        border: dividerColor,
      },
    }),
    [bgColor, textColor, dividerColor, showFixedBg],
  );

  const { instanceId, pushNotification } = useSettings();

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
      'appKey': 'JPUSH_KEY',
      'titchannelle': 'dev',
      'production': false,
    };
    debugLogger.common.debug(`JPUSH:init`, config);
    // clear badges
    JPush.setLoggerEnable(true);
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
  }, [handleNotificaitonCallback]);

  useEffect(() => {
    analyticLogEvent('initialized', {
      instanceId,
      platform: platformEnv.symbol,
      distribution: platformEnv.distributionChannel,
    });
    setAttributes({
      instanceId,
      platform: platformEnv.symbol ?? '',
      distribution: platformEnv.distributionChannel ?? '',
    });
  }, [instanceId]);

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

  return (
    <NavigationContainer
      documentTitle={{
        formatter: () => 'OneKey',
      }}
      onReady={() => {
        routeNameRef.current =
          navigationRef?.current?.getCurrentRoute?.()?.name;
      }}
      onStateChange={() => {
        const previousRouteName = routeNameRef.current;
        const currentRouteName =
          navigationRef?.current?.getCurrentRoute?.()?.name;

        if (previousRouteName !== currentRouteName) {
          debugLogger.navigation.info(
            previousRouteName,
            ' -> ',
            currentRouteName,
          );
        }

        routeNameRef.current = currentRouteName;
      }}
      ref={navigationRef}
      theme={navigationTheme}
      linking={linking}
    >
      <RootSiblingParent>
        <RootStack />
      </RootSiblingParent>
    </NavigationContainer>
  );
};

NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
