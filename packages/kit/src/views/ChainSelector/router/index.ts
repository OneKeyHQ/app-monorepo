import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import { EChainSelectorPages } from './type';

import type { IChainSelectorParamList } from './type';

const ChainSelector = LazyLoad(() => import('../pages/ChainSelector'));

export const ChainSelectorRouter: IModalFlowNavigatorConfig<
  EChainSelectorPages,
  IChainSelectorParamList
>[] = [
  {
    name: EChainSelectorPages.ChainSelector,
    component: ChainSelector,
  },
];
