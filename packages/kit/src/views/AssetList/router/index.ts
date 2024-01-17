import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { TokenListWithProvider } from '../pages/TokenList';

import { EModalAssetListRoutes } from './types';

import type { IModalAssetListParamList } from './types';

export const ModalAssetListStack: IModalFlowNavigatorConfig<
  EModalAssetListRoutes,
  IModalAssetListParamList
>[] = [
  {
    name: EModalAssetListRoutes.TokenList,
    component: TokenListWithProvider,
  },
];
