import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const MarketDetailV2Modal = LazyLoadPage(() => import('../MarketDetailV2'));
const MarketBannerDetailModal = LazyLoadPage(
  () => import('../MarketBannerDetail'),
);

export enum EModalMarketRoutes {
  MarketDetailV2 = 'MarketDetailV2',
  MarketBannerDetail = 'MarketBannerDetail',
}

export type IModalMarketParamList = {
  [EModalMarketRoutes.MarketDetailV2]: {
    tokenAddress: string;
    network: string;
    isNative?: boolean;
  };
  [EModalMarketRoutes.MarketBannerDetail]: {
    tokenListId: string;
    title: string;
    type?: EMarketBannerType;
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
  {
    name: EModalMarketRoutes.MarketBannerDetail,
    component: MarketBannerDetailModal,
  },
];
