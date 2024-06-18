import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';

import SwapHistoryDetailModal from '../pages/modal/SwapHistoryDetailModal';
import SwapHistoryListModal from '../pages/modal/SwapHistoryListModal';
import SwapMainLandModal from '../pages/modal/SwapMainLandModal';
import SwapProviderSelectModal from '../pages/modal/SwapProviderSelectModal';
import SwapToAnotherAddressModal from '../pages/modal/SwapToAnotherAddressModal';
import SwapTokenSelectModal from '../pages/modal/SwapTokenSelectModal';
import TokenRiskReminderModal from '../pages/modal/TokenRiskReminderModal';

export const ModalSwapStack: IModalFlowNavigatorConfig<
  EModalSwapRoutes,
  IModalSwapParamList
>[] = [
  {
    name: EModalSwapRoutes.SwapTokenSelect,
    component: SwapTokenSelectModal,
    translationId: ETranslations.token_selector_title,
  },
  {
    name: EModalSwapRoutes.SwapMainLand,
    component: SwapMainLandModal,
    translationId: ETranslations.swap_page_swap,
  },
  {
    name: EModalSwapRoutes.SwapProviderSelect,
    component: SwapProviderSelectModal,
    translationId: ETranslations.provider_title,
  },
  {
    name: EModalSwapRoutes.SwapHistoryList,
    component: SwapHistoryListModal,
    translationId: ETranslations.swap_history_title,
  },
  {
    name: EModalSwapRoutes.SwapHistoryDetail,
    component: SwapHistoryDetailModal,
    translationId: ETranslations.swap_history_detail_title,
  },
  {
    name: EModalSwapRoutes.SwapToAnotherAddress,
    component: SwapToAnotherAddressModal,
    translationId: ETranslations.swap_page_account_to_address_title,
  },
  {
    name: EModalSwapRoutes.TokenRiskReminder,
    component: TokenRiskReminderModal,
    translationId: ETranslations.token_selector_risk_reminder_title,
  },
];
