import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalAssetDetailsParamList } from '@onekeyhq/shared/src/routes/assetDetails';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';

import { HistoryDetails } from '../pages/HistoryDetails';
import { NFTDetails } from '../pages/NFTDetails';
import { TokenDetails } from '../pages/TokenDetails';
import { UTXODetails } from '../pages/UTXODetails';

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
