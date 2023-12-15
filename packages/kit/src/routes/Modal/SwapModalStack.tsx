import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import SwapTokenSelectModal from '../../views/Swap/container/SwapTokenSelectModal';
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
];
