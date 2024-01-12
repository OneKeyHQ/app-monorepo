import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import { EAccountManagerStacksRoutes } from './types';

import type { IAccountManagerStacksParamList } from './types';

const AccountSelectorStackPage = LazyLoad(
  () => import('../pages/AccountSelectorStack'),
);

export const AccountManagerStacks: IModalFlowNavigatorConfig<
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList
>[] = [
  {
    name: EAccountManagerStacksRoutes.AccountSelectorStack,
    component: AccountSelectorStackPage,
  },
];
