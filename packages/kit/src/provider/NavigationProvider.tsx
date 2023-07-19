import type { FC } from 'react';
import { memo, useEffect, useMemo, useRef } from 'react';

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { RootSiblingParent } from 'react-native-root-siblings';
import { FullWindowOverlay } from 'react-native-screens';

import {
  ToastManager,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';
import CustomToast from '@onekeyhq/components/src/Toast/Custom';
import { useAppSelector, useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { RootStackNavigator } from '@onekeyhq/kit/src/routes';
import type { RootRoutesParams } from '@onekeyhq/kit/src/routes/types';
import { analyticLogEvent } from '@onekeyhq/shared/src/analytics';
import { setAttributes } from '@onekeyhq/shared/src/crashlytics';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useShortcuts } from '../hooks/useShortcuts';
import '../routes/deepLink';
import buildLinking from '../routes/linking';
import { createLazyComponent } from '../utils/createLazyComponent';
import { FULLWINDOW_OVERLAY_PORTAL } from '../utils/overlayUtils';
import { PortalExit } from '../views/Overlay/RootPortal';

import RedirectProvider from './RedirectProvider';

import type { NavigationContainerRef } from '@react-navigation/native';

export type RootNavContainerRef = NavigationContainerRef<RootRoutesParams>;

const ChainWebEmbed = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/ChainWebEmbed'),
);

type NavigationAppProps = {
  children: React.ReactNode;
};

const NavigationApp: FC<NavigationAppProps> = ({ children }) => {
  const routeNameRef = useRef<string>();
  const isVerticalLayout = useIsVerticalLayout();
  const [bgColor, textColor, dividerColor] = useThemeValue([
    'background-default',
    'text-default',
    'divider',
  ]);

  // TODO: ExpoRouter: linking
  // const linking = useMemo(() => buildLinking(), []);

  const { backgroundShowToastOptions, backgroundShowToastTs } = useAppSelector(
    (s) => s.refresher,
  );

  useEffect(() => {
    if (!backgroundShowToastOptions.title) {
      return;
    }
    ToastManager.show(
      {
        title: backgroundShowToastOptions.title,
      },
      {
        type: backgroundShowToastOptions.type,
      },
    );
  }, [backgroundShowToastTs, backgroundShowToastOptions]);

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

  // TODO: ExpoRouter: navigationRef & useFlipper
  // https://reactnavigation.org/docs/devtools/#useflipper
  // only work during development and are disabled in production.
  // const rootNavigation = useRootNavigation()
  // useFlipper(navigationRef);

  useShortcuts();

  const globalPortalViews = useMemo(
    () => (
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <ChainWebEmbed />
        <CustomToast bottomOffset={60} />
        <PortalExit name={FULLWINDOW_OVERLAY_PORTAL} />
      </View>
    ),
    [],
  );

  const pathname = usePathname();
  useEffect(() => {
    const previousRouteName = routeNameRef.current ?? '';
    const currentRouteName = pathname ?? '';
    routeNameRef.current = currentRouteName;

    setAttributes({
      previousRouteName,
      currentRouteName,
    });
    if (previousRouteName !== currentRouteName) {
      debugLogger.navigation.info(previousRouteName, ' -> ', currentRouteName);
    }
  }, [pathname]);

  return (
    <ThemeProvider value={navigationTheme}>
      <RootSiblingParent>
        <RedirectProvider>
          <RootStackNavigator>{children}</RootStackNavigator>
        </RedirectProvider>
        {platformEnv.isNativeIOS ? (
          // FullWindowOverlay can render above native views
          // but can not work with modal
          // https://github.com/software-mansion/react-native-screens/issues/1149
          // so now only used for toast
          <FullWindowOverlay>{globalPortalViews}</FullWindowOverlay>
        ) : (
          globalPortalViews
        )}
      </RootSiblingParent>
    </ThemeProvider>
  );
};

NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
