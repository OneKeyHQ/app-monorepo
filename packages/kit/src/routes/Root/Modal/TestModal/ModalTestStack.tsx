import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';

import { ModalTestRoutes } from './Routes';
import TestSimpleModal from './TestSimpleModal';

import type { ModalTestParamList } from './Routes';

export const ModalTestStack: IModalFlowNavigatorConfig<
  ModalTestRoutes,
  ModalTestParamList
>[] = [
  {
    name: ModalTestRoutes.TestSimpleModal,
    component: TestSimpleModal,
    translationId: 'Locked Modal Demo',
  },
];
