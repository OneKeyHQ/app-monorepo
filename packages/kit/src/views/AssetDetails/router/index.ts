import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalAssetDetailsParamList } from '@onekeyhq/shared/src/routes/assetDetails';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const NFTDetails = LazyLoadPage(() => import('../pages/NFTDetails'));
const HistoryDetails = LazyLoadPage(
  () => import('../pages/HistoryDetails/HistoryDetails'),
);
const TokenDetails = LazyLoadPage(() => import('../pages/TokenDetails'));
const UTXODetails = LazyLoadPage(() => import('../pages/UTXODetails'));

export const ModalAssetDetailsStack: IModalFlowNavigatorConfig<
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList
>[] = [
  {
    name: EModalAssetDetailRoutes.TokenDetails,
    component: TokenDetails,
  },
  {
    name: EModalAssetDetailRoutes.NFTDetails,
    component: NFTDetails,
  },
  {
    name: EModalAssetDetailRoutes.HistoryDetails,
    component: HistoryDetails,
  },
  {
    name: EModalAssetDetailRoutes.UTXODetails,
    component: UTXODetails,
  },
];
