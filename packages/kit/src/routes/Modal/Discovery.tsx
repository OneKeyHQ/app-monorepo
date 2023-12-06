import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import FakeSearchModal from '@onekeyhq/kit/src/views/Discovery/container/Dashboard/Search';
import MobileTabListModal from '@onekeyhq/kit/src/views/Discovery/container/MobileTabListModal';
import SearchModal from '@onekeyhq/kit/src/views/Discovery/container/SearchModal';
import type { IDiscoveryModalParamList } from '@onekeyhq/kit/src/views/Discovery/router/Routes';
import { EDiscoveryModalRoutes } from '@onekeyhq/kit/src/views/Discovery/router/Routes';

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
