import { useMemo } from 'react';

import type { IRootStackNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';

import { ModalNavigator } from './Modal/Navigator';
import { fullModalRouter, modalRouter } from './Modal/router';
import { TabNavigator } from './Tab/Navigator';
import { useTabRouterConfig } from './Tab/router';

const NotFound = LazyLoad(() => import('../components/NotFound'));

export const rootRouter: IRootStackNavigatorConfig<ERootRoutes, any>[] = [
  {
    name: ERootRoutes.NotFound,
    component: NotFound,
    rewrite: '/not-found',
    exact: true,
  },
  {
    name: ERootRoutes.Main,
    component: TabNavigator,
    initialRoute: true,
  },
  {
    name: ERootRoutes.Modal,
    component: ModalNavigator,
    type: 'modal',
  },
  {
    name: ERootRoutes.iOSFullScreen,
    component: ModalNavigator,
    type: 'iOSFullScreen',
  },
];

export const useRootRouter = () => {
  const tabRouter = useTabRouterConfig();
  return useMemo(
    () => [
      {
        name: ERootRoutes.Main,
        children: tabRouter,
      },
      {
        name: ERootRoutes.Modal,
        children: modalRouter,
      },
      {
        name: ERootRoutes.iOSFullScreen,
        children: fullModalRouter,
      },
    ],
    [tabRouter],
  );
};
