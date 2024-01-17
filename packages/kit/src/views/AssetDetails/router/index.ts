import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { HistoryDetails } from '../pages/HistoryDetails';
import { NFTDetails } from '../pages/NFTDetails';
import { TokenDetails } from '../pages/TokenDetails';

import { EModalAssetDetailRoutes } from './types';

import type { IModalAssetDetailsParamList } from './types';

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
];
