import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import TabListModal from '@onekeyhq/kit/src/views/Discover/Explorer/Mobile/TabListModal';
import type { DiscoverModalParamList } from '@onekeyhq/kit/src/views/Discover/types';
import { DiscoverModalRoutes } from '@onekeyhq/kit/src/views/Discover/types';
import SearchModal from '@onekeyhq/kit/src/views/Discover/views/SearchModal/SearchModal';

export const ModalDiscoverStack: IModalFlowNavigatorConfig<
  DiscoverModalRoutes,
  DiscoverModalParamList
>[] = [
  {
    name: DiscoverModalRoutes.MobileTabList,
    component: TabListModal,
    translationId: 'title__about',
  },
  {
    name: DiscoverModalRoutes.SearchModal,
    component: SearchModal,
    translationId: 'title__accounts',
  },
];
