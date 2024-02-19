import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import { EAssetSelectorRoutes } from './types';

import type { IAssetSelectorParamList } from './types';

const TokenSelector = LazyLoad(() => import('../pages/TokenSelector'));

export const AssetSelectorRouter: IModalFlowNavigatorConfig<
  EAssetSelectorRoutes,
  IAssetSelectorParamList
>[] = [
  {
    name: EAssetSelectorRoutes.TokenSelector,
    component: TokenSelector,
  },
];
