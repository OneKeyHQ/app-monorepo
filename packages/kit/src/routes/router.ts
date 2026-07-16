import { useMemo } from 'react';

import type { IRootStackNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';

import { rootRouterPathConfig } from './routerPathConfig';
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
          allowColdStart: true,
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
    allowColdStart: true,
    initialRoute: true,
  },
  {
    name: ERootRoutes.Onboarding,
    component: OnboardingNavigator,
    allowColdStart: true,
    type: 'onboarding',
  },
  {
    name: ERootRoutes.Modal,
    component: ModalNavigator,
    allowColdStart: true,
    type: 'modal',
  },
  {
    name: ERootRoutes.iOSFullScreen,
    component: IOSFullScreenNavigator,
    allowColdStart: platformEnv.isExtension,
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

export const rootRouterPathConfigSources = [
  {
    name: ERootRoutes.Onboarding,
    pathConfigFile: './Modal/router',
    pathConfigExport: 'onboardingRouterV2Config',
  },
  {
    name: ERootRoutes.Modal,
    pathConfigFile: './Modal/router',
    pathConfigExport: 'modalRouter',
  },
  {
    name: ERootRoutes.iOSFullScreen,
    pathConfigFile: './Modal/router',
    pathConfigExport: 'fullModalRouter',
  },
  {
    name: ERootRoutes.FullScreenPush,
    pathConfigFile: './Modal/router',
    pathConfigExport: 'fullScreenPushRouterConfig',
  },
  {
    name: ERootRoutes.WebView,
    pathConfigFile: './WebView/router',
    pathConfigExport: 'webViewRouter',
  },
] as const;

if (platformEnv.isDev) {
  const NotFound = LazyLoad(() => import('../components/NotFound'));
  rootRouter.push({
    name: ERootRoutes.NotFound,
    component: NotFound,
    allowColdStart: true,
  });
}

export const useRootRouter = () => {
  const tabRouter = useTabRouterConfig();
  return useMemo(
    () =>
      rootRouterPathConfig.map((route) =>
        route.name === ERootRoutes.Main
          ? {
              ...route,
              children: tabRouter,
            }
          : route,
      ),
    [tabRouter],
  );
};
