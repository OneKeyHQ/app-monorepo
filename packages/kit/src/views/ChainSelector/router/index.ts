import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IChainSelectorParamList } from '@onekeyhq/shared/src/routes';
import { EChainSelectorPages } from '@onekeyhq/shared/src/routes';

const ChainSelector = LazyLoadPage(() => import('../pages/ChainSelector'));
const ConfigurableChainSelector = LazyLoadPage(
  () => import('../pages/ConfigurableChainSelector'),
);

export const ChainSelectorRouter: IModalFlowNavigatorConfig<
  EChainSelectorPages,
  IChainSelectorParamList
>[] = [
  {
    name: EChainSelectorPages.ChainSelector,
    component: ChainSelector,
  },
  {
    name: EChainSelectorPages.ConfigurableChainSelector,
    component: ConfigurableChainSelector,
  },
];
