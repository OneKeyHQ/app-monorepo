import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

import { EModalMarketRoutes, type IModalMarketParamList } from './types';

const MarketDetailV2Modal = LazyLoadPage(
  () => import(/* webpackChunkName: "market-detail-v2" */ '../MarketDetailV2'),
);
const MarketBannerDetailModal = LazyLoadPage(
  () => import('../MarketBannerDetail'),
);
const MobileTokenSelectorModal = LazyLoadPage(
  () =>
    import('../MarketDetailV2/components/TokenSelector/MobileTokenSelector'),
);
const MarketChartSettingsModal = LazyLoadPage(
  () => import('../MarketDetailV2/components/MarketChartSettingsModal'),
);

export { EModalMarketRoutes };
export type { IModalMarketParamList };

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
  {
    name: EModalMarketRoutes.MobileTokenSelector,
    component: MobileTokenSelectorModal,
  },
  {
    name: EModalMarketRoutes.MarketChartSettings,
    component: MarketChartSettingsModal,
    modalContentMaxHeight: 544,
  },
];
