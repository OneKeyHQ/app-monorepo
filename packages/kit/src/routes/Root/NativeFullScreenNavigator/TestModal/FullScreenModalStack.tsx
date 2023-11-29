import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { ENativeFullModalTestRoutes } from './Routes';
import TestSimpleModal from './TestSimpleModal';

import type { IModalTestParamList } from './Routes';

export const FullTestModalStack: IModalFlowNavigatorConfig<
  ENativeFullModalTestRoutes,
  IModalTestParamList
>[] = [
  {
    name: ENativeFullModalTestRoutes.TestFullSimpleModal,
    component: TestSimpleModal,
  },
];
