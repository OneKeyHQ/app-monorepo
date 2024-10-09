import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IChainSelectorParamList } from '@onekeyhq/shared/src/routes';
import { EChainSelectorPages } from '@onekeyhq/shared/src/routes';

const AccountChainSelector = LazyLoadPage(
  () => import('../pages/AccountChainSelector'),
);
const ChainSelector = LazyLoadPage(() => import('../pages/ChainSelector'));

const SettingCustomNetworkModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/CustomNetwork'),
);

export const ChainSelectorRouter: IModalFlowNavigatorConfig<
  EChainSelectorPages,
  IChainSelectorParamList
>[] = [
  {
    name: EChainSelectorPages.AccountChainSelector,
    component: AccountChainSelector,
  },
  {
    name: EChainSelectorPages.ChainSelector,
    component: ChainSelector,
  },
  {
    name: EChainSelectorPages.AddCustomNetwork,
    component: SettingCustomNetworkModal,
  },
];
