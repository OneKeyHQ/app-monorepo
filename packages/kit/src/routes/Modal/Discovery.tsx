import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type { IDiscoveryModalParamList } from '@onekeyhq/kit/src/views/Discovery/router/Routes';
import { EDiscoveryModalRoutes } from '@onekeyhq/kit/src/views/Discovery/router/Routes';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

const SearchModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Discovery/pages/SearchModal'),
);

const MobileTabListModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Discovery/pages/MobileTabListModal'),
);

const BookmarkListModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Discovery/pages/BookmarkListModal'),
);

const HistoryListModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Discovery/pages/HistoryListModal'),
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
