import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { Selector } from '../pages';

import { EChainSelectorPages } from './type';

import type { IChainSelectorParamList } from './type';

export const ChainSelectorRouter: IModalFlowNavigatorConfig<
  EChainSelectorPages,
  IChainSelectorParamList
>[] = [
  {
    name: EChainSelectorPages.Selector,
    component: Selector,
  },
];
