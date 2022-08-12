import React, { memo, useEffect, useMemo, useRef } from 'react';

import {
  DefaultTheme,
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';

import { useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import RootStack from '@onekeyhq/kit/src/routes/Root';
import { RootRoutesParams } from '@onekeyhq/kit/src/routes/types';
import { analyticLogEvent } from '@onekeyhq/shared/src/analytics';
import { setAttributes } from '@onekeyhq/shared/src/crashlytics';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import linking from '../routes/linking';
import { PortalElementsContainer } from '../routes/PortalElementsContainer';

import { useAutoNavigateOnMount } from './useAutoNavigateOnMount';

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
  const routeNameRef = useRef<string>();
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

  const { instanceId } = useSettings();

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

  return (
    <>
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
        <RootStack />
        {/* TODO migrate all global popups to rootsibling */}
        <PortalElementsContainer />
      </NavigationContainer>
    </>
  );
};

NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
