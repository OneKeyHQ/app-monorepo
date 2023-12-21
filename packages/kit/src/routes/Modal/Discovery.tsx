import { lazy } from 'react';

import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type { IDiscoveryModalParamList } from '@onekeyhq/kit/src/views/Discovery/router/Routes';
import { EDiscoveryModalRoutes } from '@onekeyhq/kit/src/views/Discovery/router/Routes';

const SearchModal = lazy(
  () => import('@onekeyhq/kit/src/views/Discovery/container/SearchModal'),
);

const MobileTabListModal = lazy(
  () =>
    import('@onekeyhq/kit/src/views/Discovery/container/MobileTabListModal'),
);

const BookmarkListModal = lazy(
  () => import('@onekeyhq/kit/src/views/Discovery/container/BookmarkListModal'),
);

const HistoryListModal = lazy(
  () => import('@onekeyhq/kit/src/views/Discovery/container/HistoryListModal'),
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
    name: EDiscoveryModalRoutes.BookmarkListModal,
    component: BookmarkListModal,
  },

  {
    name: EDiscoveryModalRoutes.HistoryListModal,
    component: HistoryListModal,
  },
];
