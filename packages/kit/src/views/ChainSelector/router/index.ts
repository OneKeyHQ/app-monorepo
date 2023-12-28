import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import { EChainSelectorPages } from './type';

import type { IChainSelectorParamList } from './type';

const Selector = LazyLoad(() => import('../pages'));

export const ChainSelectorRouter: IModalFlowNavigatorConfig<
  EChainSelectorPages,
  IChainSelectorParamList
>[] = [
  {
    name: EChainSelectorPages.Selector,
    component: Selector,
  },
];
