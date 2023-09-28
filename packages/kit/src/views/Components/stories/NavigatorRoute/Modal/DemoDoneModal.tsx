import { Stack } from '@onekeyhq/components';
import type { ModalFlowNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';

import { DemoDoneModalRoutes } from './RootModalRoutes';

export type DemoDoneModalParamList = {
  [DemoDoneModalRoutes.DemoDoneModal]: undefined;
  [DemoDoneModalRoutes.DemoDone1Modal]: undefined;
};

const DemoDoneViewModal = () => {
  console.log('DemoCreateViewModal');

  return <Stack />;
};

const DemoDone1ViewModal = () => {
  console.log('DemoCreateViewModal');

  return <Stack />;
};

export const DoneModalStack: ModalFlowNavigatorConfig<
  DemoDoneModalRoutes,
  DemoDoneModalParamList
>[] = [
  {
    name: DemoDoneModalRoutes.DemoDoneModal,
    component: DemoDoneViewModal,
    translationId: 'Modal Done',
  },
  {
    name: DemoDoneModalRoutes.DemoDone1Modal,
    component: DemoDone1ViewModal,
    translationId: 'Modal Done 1',
  },
];
