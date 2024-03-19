import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';

import SwapHistoryDetailModal from '../pages/modal/SwapHistoryDetailModal';
import SwapHistoryListModal from '../pages/modal/SwapHistoryListModal';
import SwapNetworkSelectModal from '../pages/modal/SwapNetworkSelectModal';
import SwapProviderSelectModal from '../pages/modal/SwapProviderSelectModal';
import SwapToAnotherAddressModal from '../pages/modal/SwapToAnotherAddressModal';
import SwapTokenSelectModal from '../pages/modal/SwapTokenSelectModal';

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
  {
    name: EModalSwapRoutes.SwapHistoryList,
    component: SwapHistoryListModal,
    translationId: 'transaction__history',
  },
  {
    name: EModalSwapRoutes.SwapHistoryDetail,
    component: SwapHistoryDetailModal,
    translationId: 'content__details',
  },
  {
    name: EModalSwapRoutes.SwapToAnotherAddress,
    component: SwapToAnotherAddressModal,
    translationId: 'form__enter_address',
  },
];
