import type { ModalFlowNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import MobileTabListModal from '@onekeyhq/kit/src/views/Discovery/container/MobileTabListModal';
import SearchModal from '@onekeyhq/kit/src/views/Discovery/container/SearchModal';
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
