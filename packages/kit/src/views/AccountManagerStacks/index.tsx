import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { SelectorStack } from './SelectorStack';
import { EAccountManagerStacksRoutes } from './types';

import type { IAccountManagerStacksParamList } from './types';

export const AccountManagerStacks: IModalFlowNavigatorConfig<
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList
>[] = [
  {
    name: EAccountManagerStacksRoutes.SelectorStack,
    component: SelectorStack,
  },
];
