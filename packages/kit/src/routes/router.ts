import { useMemo } from 'react';

import type { IStackNavigationOptions } from '@onekeyhq/components';
import type { IRootStackNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { OAUTH_CALLBACK_WEB_PATH } from '@onekeyhq/shared/src/consts/authConsts';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';

import { TradingViewNativeFullscreenPage } from '../components/TradingView/TradingViewNative/TradingViewNativePresentation';

import {
  FullScreenPushNavigator,
  IOSFullScreenNavigator,
  ModalNavigator,
  OnboardingNavigator,
  WebViewNavigator,
} from './LazyRootNavigators';
import {
  fullModalRouterPathConfig,
  fullScreenPushRouterPathConfig,
  modalRouterPathConfig,
  onboardingRouterV2PathConfig,
  webViewRouterPathConfig,
} from './routerPathConfig';
import { TabNavigator } from './Tab/Navigator';
import { useTabRouterConfig } from './Tab/router';

const buildPermissionRouter = () => {
  const PromptWebDeviceAccessPage = LazyLoad(
    () =>
      import('@onekeyhq/kit/src/views/Permission/PromptWebDeviceAccessPage'),
  );
  return [
    platformEnv.isExtension
      ? {
          name: ERootRoutes.PermissionWebDevice,
          component: PromptWebDeviceAccessPage,
          rewrite: '/permission/web-device',
          exact: true,
        }
      : undefined,
  ].filter(Boolean);
};

// Web-only real route for the OAuth popup redirect. Supabase redirects the
// popup to `${origin}${OAUTH_CALLBACK_WEB_PATH}?code=...`; without a matching
// route the path falls into the `NotFound: '*'` wildcard and getPathFromState
// rewrites the URL to '/', stripping `?code=` before the opener window can
// poll it. Keep this off extension/desktop/native to avoid widening their
// deeplink/routing surface.
const buildOAuthCallbackWebRouter = () => {
  const OAuthCallbackWebPage = LazyLoad(
    () => import('@onekeyhq/kit/src/views/OAuthCallbackWeb'),
  );
  return [
    platformEnv.isWeb
      ? {
          name: ERootRoutes.OAuthCallbackWeb,
          component: OAuthCallbackWebPage,
          rewrite: OAUTH_CALLBACK_WEB_PATH,
          exact: true,
        }
      : undefined,
  ].filter(Boolean);
};

export const rootRouter: IRootStackNavigatorConfig<ERootRoutes, any>[] = [
  {
    name: ERootRoutes.Main,
    component: TabNavigator,
    initialRoute: true,
  },
  {
    name: ERootRoutes.Onboarding,
    component: OnboardingNavigator,
    type: 'onboarding',
  },
  {
    name: ERootRoutes.Modal,
    component: ModalNavigator,
    type: 'modal',
    options: ({ route }): IStackNavigationOptions =>
      platformEnv.isNativeIOS &&
      !platformEnv.isNativeIOSPad &&
      route.params?.tradingViewFullscreen === true
        ? { orientation: 'landscape' }
        : {},
  },
  {
    name: ERootRoutes.iOSFullScreen,
    component: IOSFullScreenNavigator,
    type: 'iOSFullScreen',
  },
  {
    name: ERootRoutes.FullScreenPush,
    component: FullScreenPushNavigator,
    type: 'fullScreenPush',
  },
  {
    name: ERootRoutes.WebView,
    component: WebViewNavigator,
    type: 'webView',
  },
  ...(platformEnv.isNativeIOS
    ? [
        {
          name: ERootRoutes.TradingViewNativeFullscreen,
          component: TradingViewNativeFullscreenPage,
          options: (): IStackNavigationOptions => ({
            headerShown: false,
            // Keep the detail's native views laid out beneath the opaque chart.
            presentation: 'transparentModal',
            animation: 'none',
            orientation: platformEnv.isNativeIOSPad ? 'default' : 'landscape',
            orientationAnimated: false,
            contentReady: false,
            gestureEnabled: false,
          }),
        },
      ]
    : []),
  ...buildPermissionRouter(),
  ...buildOAuthCallbackWebRouter(),
];

if (platformEnv.isDev) {
  const NotFound = LazyLoad(() => import('../components/NotFound'));
  rootRouter.push({
    name: ERootRoutes.NotFound,
    component: NotFound,
  });
}

export const useRootRouter = () => {
  const tabRouter = useTabRouterConfig();
  return useMemo(
    () => [
      {
        name: ERootRoutes.Main,
        children: tabRouter,
      },
      {
        name: ERootRoutes.Onboarding,
        children: onboardingRouterV2PathConfig,
      },
      {
        name: ERootRoutes.Modal,
        children: modalRouterPathConfig,
      },
      {
        name: ERootRoutes.iOSFullScreen,
        children: fullModalRouterPathConfig,
      },
      {
        name: ERootRoutes.FullScreenPush,
        children: fullScreenPushRouterPathConfig,
      },
      {
        name: ERootRoutes.WebView,
        children: webViewRouterPathConfig,
      },

      ...buildPermissionRouter(),
      ...buildOAuthCallbackWebRouter(),
    ],
    [tabRouter],
  );
};
