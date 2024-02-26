import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';

import { EChainSelectorPages } from './type';

import type { IChainSelectorParamList } from './type';

const ChainSelector = LazyLoadPage(() => import('../pages/ChainSelector'));

export const ChainSelectorRouter: IModalFlowNavigatorConfig<
  EChainSelectorPages,
  IChainSelectorParamList
>[] = [
  {
    name: EChainSelectorPages.ChainSelector,
    component: ChainSelector,
  },
];
