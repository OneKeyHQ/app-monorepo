import type { ModalFlowNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';

import { ModalTestParamList, ModalTestRoutes } from './Routes';
import TestSimpleModal from './TestSimpleModal';

export const ModalTestStack: ModalFlowNavigatorConfig<
  ModalTestRoutes,
  ModalTestParamList
>[] = [
  {
    name: ModalTestRoutes.TestSimpleModal,
    component: TestSimpleModal,
    translationId: 'Locked Modal Demo',
  },
];
