import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';

import { EAssetSelectorRoutes } from './types';

import type { IAssetSelectorParamList } from './types';

const TokenSelector = LazyLoadPage(() => import('../pages/TokenSelector'));

export const AssetSelectorRouter: IModalFlowNavigatorConfig<
  EAssetSelectorRoutes,
  IAssetSelectorParamList
>[] = [
  {
    name: EAssetSelectorRoutes.TokenSelector,
    component: TokenSelector,
  },
];
