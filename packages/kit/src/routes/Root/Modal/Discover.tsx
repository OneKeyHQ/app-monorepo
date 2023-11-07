import type { ModalFlowNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import SearchModal from '@onekeyhq/kit/src/views/Discover/views/SearchModal/SearchModal';
import MobileTabListModal from '@onekeyhq/kit/src/views/Discovery/container/MobileTabListModal';
import type { DiscoverModalParamList } from '@onekeyhq/kit/src/views/Discovery/router/Routes';
import { DiscoverModalRoutes } from '@onekeyhq/kit/src/views/Discovery/router/Routes';

export const ModalDiscoverStack: ModalFlowNavigatorConfig<
  DiscoverModalRoutes,
  DiscoverModalParamList
>[] = [
  {
    name: DiscoverModalRoutes.MobileTabList,
    component: MobileTabListModal,
    translationId: 'title__about',
  },
  {
    name: DiscoverModalRoutes.SearchModal,
    component: SearchModal,
    translationId: 'title__accounts',
  },
];
