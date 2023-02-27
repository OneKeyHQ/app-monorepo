import { createRef, memo, useEffect, useMemo, useRef } from 'react';

import { useFlipper } from '@react-navigation/devtools';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { RootSiblingParent } from 'react-native-root-siblings';

import { useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import RootStack from '@onekeyhq/kit/src/routes/Root';
import type { RootRoutesParams } from '@onekeyhq/kit/src/routes/types';
import { analyticLogEvent } from '@onekeyhq/shared/src/analytics';
import { setAttributes } from '@onekeyhq/shared/src/crashlytics';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import '../routes/deepLink';
import buildLinking from '../routes/linking';

import RedirectProvider from './RedirectProvider';

import type { NavigationContainerRef } from '@react-navigation/native';

import { useShortcuts } from '../hooks/useShortcuts';

export type RootNavContainerRef = NavigationContainerRef<RootRoutesParams>;
export const navigationRef = createRef<RootNavContainerRef>();

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var $navigationRef: typeof navigationRef;
}

// update navigationRef.current at <NavigationContainer />
global.$navigationRef = navigationRef;

const NavigationApp = () => {
  const routeNameRef = useRef<string>();
  const isVerticalLayout = useIsVerticalLayout();
  const [bgColor, textColor, dividerColor] = useThemeValue([
    'background-default',
    'text-default',
    'divider',
  ]);

  const linking = useMemo(
    () => buildLinking(isVerticalLayout),
    [isVerticalLayout],
  );

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

  global.$$onekeyPerfTrace?.log({
    name: 'NavigationProvider/NavigationApp render',
    payload: {
      instanceId,
      isVerticalLayout,
      bgColor,
      textColor,
      dividerColor,
    },
  });

  // https://reactnavigation.org/docs/devtools/#useflipper
  // only work during development and are disabled in production.
  useFlipper(navigationRef);

  useShortcuts();

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

        setAttributes({
          previousRouteName: previousRouteName ?? '',
          currentRouteName: currentRouteName ?? '',
        });
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
        <RedirectProvider>
          <RootStack />
        </RedirectProvider>
      </RootSiblingParent>
    </NavigationContainer>
  );
};

NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
