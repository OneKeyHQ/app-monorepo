import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { LazyLoadPage } from '../../../components/LazyLoadPage';
import { MarketDetailV2 as MarketDetailV2Modal } from '../MarketDetailV2';

import { EModalMarketRoutes, type IModalMarketParamList } from './types';

const MarketBannerDetailModal = LazyLoadPage(
  () => import('../MarketBannerDetail'),
);
const MobileTokenSelectorModal = LazyLoadPage(
  () =>
    import('../MarketDetailV2/components/TokenSelector/MobileTokenSelector'),
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
];
