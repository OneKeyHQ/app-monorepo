import { lazy } from 'react';

import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { EAccountManagerStacksRoutes } from './types';

import type { IAccountManagerStacksParamList } from './types';

const SelectorStack = lazy(() => import('./SelectorStack'));

export const AccountManagerStacks: IModalFlowNavigatorConfig<
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList
>[] = [
  {
    name: EAccountManagerStacksRoutes.SelectorStack,
    component: SelectorStack,
  },
];
