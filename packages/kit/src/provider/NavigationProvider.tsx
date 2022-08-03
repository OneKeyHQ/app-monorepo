import React, { memo, useEffect, useMemo, useRef } from 'react';

import { OverlayProvider } from '@react-native-aria/overlays';
import {
  DefaultTheme,
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { Host } from 'react-native-portalize';

import {
  Box,
  DialogManager,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';
import Toast from '@onekeyhq/components/src/Toast/Custom';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import RootStack from '@onekeyhq/kit/src/routes/Root';
import { RootRoutesParams } from '@onekeyhq/kit/src/routes/types';
import HardwarePopup from '@onekeyhq/kit/src/views/Hardware/PopupHandle';
import HardwareSpecialPopup from '@onekeyhq/kit/src/views/Hardware/PopupHandle/SpecialPopup';
import { analyticLogEvent } from '@onekeyhq/shared/src/analytics';
import { setAttributes } from '@onekeyhq/shared/src/crashlytics';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import linking from '../routes/linking';

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
        <Host>
          <OverlayProvider>
            <RootStack />
          </OverlayProvider>
        </Host>
      </NavigationContainer>
      <Box
        overflow="hidden"
        pointerEvents="none"
        position="absolute"
        top={0}
        bottom={0}
        left={0}
        right={0}
      >
        <Toast bottomOffset={60} />
        <DialogManager.Holder />
        <HardwarePopup />
        <HardwareSpecialPopup />
      </Box>
    </>
  );
};

NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
