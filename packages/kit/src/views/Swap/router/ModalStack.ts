import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import SwapNetworkSelectModal from '../Modals/SwapNetworkSelectModal';
import SwapTokenSelectModal from '../Modals/SwapTokenSelectModal';
import { EModalSwapRoutes } from '../types';

import type { IModalSwapParamList } from '../types';

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
