import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import { EDiscoveryModalRoutes } from '@onekeyhq/shared/src/routes';

const SearchModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Discovery/pages/SearchModal'),
);

const MobileTabListModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Discovery/pages/MobileTabListModal'),
);

const BookmarkListModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Discovery/pages/BookmarkListModal'),
);

const HistoryListModal = LazyLoadPage(
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
