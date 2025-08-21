import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const MarketDetailV2Modal = LazyLoadPage(() => import('../MarketDetailV2'));

export enum EModalMarketRoutes {
  MarketDetailV2 = 'MarketDetailV2',
}

export type IModalMarketParamList = {
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
    name: EModalMarketRoutes.MarketDetailV2,
    component: MarketDetailV2Modal,
    translationId: ETranslations.dexmarket_details_overview,
  },
];
