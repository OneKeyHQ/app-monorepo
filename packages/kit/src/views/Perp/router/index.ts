import type {
  IModalFlowNavigatorConfig,
  ITabSubNavigatorConfig,
} from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalPerpParamList } from '@onekeyhq/shared/src/routes/perp';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import {
  LazyLoadPage,
  LazyLoadRootTabPage,
} from '../../../components/LazyLoadPage';
import PerpTradersHistoryList from '../components/OrderInfoPanel/PerpTradersHistoryListModal';

const PagePerp = LazyLoadRootTabPage(() => import('../pages/Perp'));
const MobilePerpMarketPage = LazyLoadPage(
  () => import('../pages/MobilePerpMarket'),
);

export const perpRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabRoutes.Perp,
    component: PagePerp,
  },
  {
    name: EModalPerpRoutes.MobilePerpMarket,
    component: MobilePerpMarketPage,
  },
];

export const ModalPerpStack: IModalFlowNavigatorConfig<
  EModalPerpRoutes,
  IModalPerpParamList
>[] = [
  {
    name: EModalPerpRoutes.PerpTradersHistoryList,
    component: PerpTradersHistoryList,
  },
  {
    name: EModalPerpRoutes.MobilePerpMarket,
    component: MobilePerpMarketPage,
  },
];
