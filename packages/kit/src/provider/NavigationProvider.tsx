import React, { memo, useEffect, useMemo } from 'react';

import { OverlayProvider } from '@react-native-aria/overlays';
import {
  DefaultTheme,
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { createURL } from 'expo-linking';
import { Host } from 'react-native-portalize';

import { Box, DialogManager, useThemeValue } from '@onekeyhq/components';
import Toast from '@onekeyhq/components/src/Toast/Custom';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import RootStack from '@onekeyhq/kit/src/routes/Root';
import { RootRoutesParams } from '@onekeyhq/kit/src/routes/types';
import HardwarePopup from '@onekeyhq/kit/src/views/Hardware/PopupHandle';
import HardwareSpecialPopup from '@onekeyhq/kit/src/views/Hardware/PopupHandle/SpecialPopup';
import { analyticLogEvent } from '@onekeyhq/shared/src/analytics';
import { setAttributes } from '@onekeyhq/shared/src/crashlytics';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAutoNavigateOnMount } from './useAutoNavigateOnMount';

const prefix = createURL('/');

export type RootNavContainerRef = NavigationContainerRef<RootRoutesParams>;
export const navigationRef = React.createRef<RootNavContainerRef>();

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var $navigationRef: typeof navigationRef;
}

// update navigationRef.current at <NavigationContainer />
global.$navigationRef = navigationRef;

const linking = {
  prefixes: [prefix],
};
let enableLinkingRoute =
  platformEnv.isDev || platformEnv.isNative || platformEnv.isExtension;

// firefox: popup window trigger resize issue
if (platformEnv.isExtensionUiPopup && platformEnv.isRuntimeFirefox) {
  enableLinkingRoute = false;
}
// firefox: router back auto-reload navigation issue
//        may be caused by @react-navigation+native+6.0.6.patch
if (platformEnv.isExtFirefox) {
  enableLinkingRoute = false;
}

const NavigationApp = () => {
  useAutoNavigateOnMount();
  const [bgColor, textColor, dividerColor] = useThemeValue([
    'surface-subdued',
    'text-default',
    'divider',
  ]);

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: platformEnv.isNativeAndroid ? bgColor : 'transparent',
        card: bgColor,
        text: textColor,
        border: dividerColor,
      },
    }),
    [bgColor, textColor, dividerColor],
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
        ref={navigationRef}
        theme={navigationTheme}
        linking={enableLinkingRoute ? linking : undefined}
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
