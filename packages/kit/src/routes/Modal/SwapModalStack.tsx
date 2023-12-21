import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import SwapNetworkSelectModal from '../../views/Swap/container/modal/SwapNetworkSelectModal';
import SwapProviderSelectModal from '../../views/Swap/container/modal/SwapProviderSelectModal';
import SwapTokenSelectModal from '../../views/Swap/container/modal/SwapTokenSelectModal';
import { EModalSwapRoutes } from '../../views/Swap/router/Routers';

import type { IModalSwapParamList } from '../../views/Swap/router/Routers';

export const ModalSwapStack: IModalFlowNavigatorConfig<
  EModalSwapRoutes,
  IModalSwapParamList
>[] = [
  {
    name: EModalSwapRoutes.SwapTokenSelect,
    component: SwapTokenSelectModal,
    translationId: 'title__select_a_token',
  },
  {
    name: EModalSwapRoutes.SwapNetworkSelect,
    component: SwapNetworkSelectModal,
    translationId: 'title__select_networks',
  },
  {
    name: EModalSwapRoutes.SwapProviderSelect,
    component: SwapProviderSelectModal,
    translationId: 'title__select_route',
  },
];
