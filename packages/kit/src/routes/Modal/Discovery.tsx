import { lazy } from 'react';

import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type { IDiscoveryModalParamList } from '@onekeyhq/kit/src/views/Discovery/router/Routes';
import { EDiscoveryModalRoutes } from '@onekeyhq/kit/src/views/Discovery/router/Routes';

const SearchModal = lazy(
  () => import('@onekeyhq/kit/src/views/Discovery/container/SearchModal'),
);

const MobileTabListModal = lazy(
  () => import('@onekeyhq/kit/src/views/Discovery/container/MobileTabListModal'),
);

const FakeSearchModal = lazy(
  () => import('@onekeyhq/kit/src/views/Discovery/container/Dashboard/Search'),
);

export const ModalDiscoveryStack: IModalFlowNavigatorConfig<
  EDiscoveryModalRoutes,
  IDiscoveryModalParamList
>[] = [
  {
    name: EDiscoveryModalRoutes.MobileTabList,
    component: MobileTabListModal,
  },
  {
    name: EDiscoveryModalRoutes.SearchModal,
    component: SearchModal,
  },
  {
    name: EDiscoveryModalRoutes.FakeSearchModal,
    component: FakeSearchModal,
  },
];
