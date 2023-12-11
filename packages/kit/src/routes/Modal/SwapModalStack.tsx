import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import SwapNetworkSelectModal from '../../views/Swap/container/SwapNetworkSelectModal';
import SwapTokenSelectModal from '../../views/Swap/container/SwapTokenSelectModal';
import { EModalSwapRoutes } from '../../views/Swap/router/Routers';

import type { IModalSwapParamList } from '../../views/Swap/router/Routers';

export const ModalSwapStack: IModalFlowNavigatorConfig<
  EModalSwapRoutes,
  IModalSwapParamList
>[] = [
  {
    name: EModalSwapRoutes.SwapNetworkSelect,
    component: SwapNetworkSelectModal,
    translationId: 'modal__select_chain',
  },
  {
    name: EModalSwapRoutes.SwapTokenSelect,
    component: SwapTokenSelectModal,
    translationId: 'title__select_a_token',
  },
];
