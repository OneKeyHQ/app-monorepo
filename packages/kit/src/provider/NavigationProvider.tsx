import React, { memo, useMemo } from 'react';

import {
  DefaultTheme,
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { createURL } from 'expo-linking';

import { Box, DialogManager, useThemeValue } from '@onekeyhq/components';
import Toast from '@onekeyhq/components/src/Toast/Custom';
import RootStack from '@onekeyhq/kit/src/routes/Root';
import { RootRoutesParams } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const prefix = createURL('/');

export type RootNavContainerRef = NavigationContainerRef<RootRoutesParams>;
export const navigationRef = React.createRef<RootNavContainerRef>();

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var $navigationRef: typeof navigationRef;
}

// update navigationRef.current at <NavigationContainer />
global.$navigationRef = navigationRef;

const NavigationApp = () => {
  const linking = {
    prefixes: [prefix],
  };
  let enableLinkingRoute =
    platformEnv.isDev || platformEnv.isNative || platformEnv.isExtension;
  // firefox popup window resize issue
  if (platformEnv.isExtensionUiPopup && platformEnv.isRuntimeFirefox) {
    enableLinkingRoute = false;
  }

  const [bgColor, textColor] = useThemeValue([
    'surface-subdued',
    'text-default',
    'background-default',
  ]);

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: 'transparent',
        card: bgColor,
        text: textColor,
      },
    }),
    [bgColor, textColor],
  );

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        linking={enableLinkingRoute ? linking : undefined}
      >
        <RootStack />
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
      </Box>
    </>
  );
};

NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
