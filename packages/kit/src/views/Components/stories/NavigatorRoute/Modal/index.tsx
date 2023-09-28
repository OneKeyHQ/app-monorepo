import type { ModalRootNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import { RootModalNavigator } from '@onekeyhq/components/src/Navigation/Navigator';

import { CreateModalStack } from './DemoCreateModal';
import { DoneModalStack } from './DemoDoneModal';
import { DemoRootModalRoutes } from './RootModalRoutes';

const modalStackScreenList: ModalRootNavigatorConfig<DemoRootModalRoutes> = [
  {
    name: DemoRootModalRoutes.DemoCreateModal,
    children: CreateModalStack,
  },
  {
    name: DemoRootModalRoutes.DemoDoneModal,
    children: DoneModalStack,
  },
];

export default function DemoModalStackScreen() {
  return (
    <RootModalNavigator<DemoRootModalRoutes> config={modalStackScreenList} />
  );
}
