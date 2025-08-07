import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const MarketSwapModal = LazyLoadPage(
  () => import('../MarketSwap/MarketSwapModal'),
);

const MarketDetailV2Modal = LazyLoadPage(() => import('../MarketDetailV2'));

export enum EModalMarketRoutes {
  MarketSwap = 'MarketSwap',
  MarketDetailV2 = 'MarketDetailV2',
}

export type IModalMarketParamList = {
  [EModalMarketRoutes.MarketSwap]: {
    networkId: string;
    tokenAddress: string;
  };
  [EModalMarketRoutes.MarketDetailV2]: {
    tokenAddress: string;
    networkId: string;
    symbol?: string;
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
  {
    name: EModalMarketRoutes.MarketDetailV2,
    component: MarketDetailV2Modal,
    translationId: ETranslations.dexmarket_details_overview,
  },
];
