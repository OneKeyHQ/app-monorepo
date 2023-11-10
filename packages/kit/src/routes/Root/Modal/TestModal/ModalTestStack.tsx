import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';

import { EModalTestRoutes } from './Routes';
import TestSimpleModal from './TestSimpleModal';

import type { IModalTestParamList } from './Routes';

export const ModalTestStack: IModalFlowNavigatorConfig<
  EModalTestRoutes,
  IModalTestParamList
>[] = [
  {
    name: EModalTestRoutes.TestSimpleModal,
    component: TestSimpleModal,
    translationId: 'Locked Modal Demo',
  },
];
