import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const MarketSwapModal = LazyLoadPage(
  () => import('../MarketSwap/MarketSwapModal'),
);

export enum EModalMarketRoutes {
  MarketSwap = 'MarketSwap',
}

export type IModalMarketParamList = {
  [EModalMarketRoutes.MarketSwap]: {
    networkId: string;
    tokenAddress: string;
  };
};

export const ModalMarketStack: IModalFlowNavigatorConfig<
  EModalMarketRoutes,
  IModalMarketParamList
>[] = [
  {
    name: EModalMarketRoutes.MarketSwap,
    component: MarketSwapModal,
    translationId: ETranslations.global_swap,
  },
];
