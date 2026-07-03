import { useMemo } from 'react';

import type { IRootStackNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';

import {
  fullModalRouterPathConfig,
  fullScreenPushRouterPathConfig,
  modalRouterPathConfig,
  onboardingRouterV2PathConfig,
  webViewRouterPathConfig,
} from './routerPathConfig';
import { TabNavigator } from './Tab/Navigator';
import { useTabRouterConfig } from './Tab/router';

const ModalNavigator = LazyLoad(async () => {
  const { ModalNavigator: Component } = await import('./Modal/Navigator');
  return { default: Component };
});

const IOSFullScreenNavigator = LazyLoad(async () => {
  const { IOSFullScreenNavigator: Component } =
    await import('./Modal/Navigator');
  return { default: Component };
});

const FullScreenPushNavigator = LazyLoad(async () => {
  const { FullScreenPushNavigator: Component } =
    await import('./Modal/Navigator');
  return { default: Component };
});

const OnboardingNavigator = LazyLoad(async () => {
  const { OnboardingNavigator: Component } = await import('./Modal/Navigator');
  return { default: Component };
});

const WebViewNavigator = LazyLoad(async () => {
  const { WebViewNavigator: Component } = await import('./WebView/Navigator');
  return { default: Component };
});

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
  ...buildPermissionRouter(),
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
    ],
    [tabRouter],
  );
};
