import type { ModalFlowNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import TabListModal from '@onekeyhq/kit/src/views/Discover/Explorer/Mobile/TabListModal';
import type { DiscoverModalParamList } from '@onekeyhq/kit/src/views/Discover/types';
import { DiscoverModalRoutes } from '@onekeyhq/kit/src/views/Discover/types';

export const ModalDiscoverStack: ModalFlowNavigatorConfig<
  DiscoverModalRoutes,
  DiscoverModalParamList
>[] = [
  {
    name: DiscoverModalRoutes.MobileTabList,
    component: TabListModal,
    translationId: 'title__about',
  },
];
