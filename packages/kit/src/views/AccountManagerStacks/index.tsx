import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { AccountSelectorStackPage } from './AccountSelectorStack';
import { EAccountManagerStacksRoutes } from './types';

import type { IAccountManagerStacksParamList } from './types';

export const AccountManagerStacks: IModalFlowNavigatorConfig<
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList
>[] = [
  {
    name: EAccountManagerStacksRoutes.AccountSelectorStack,
    component: AccountSelectorStackPage,
  },
];
