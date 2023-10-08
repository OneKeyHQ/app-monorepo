import type { ModalRootNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import { RootModalNavigator } from '@onekeyhq/components/src/Navigation/Navigator';

import { CreateModalStack } from './DemoCreateModal';
import { DoneModalStack } from './DemoDoneModal';
import { RootModalRoutes } from './Routes';

const modalStackScreenList: ModalRootNavigatorConfig<RootModalRoutes>[] = [
  {
    name: RootModalRoutes.DemoCreateModal,
    children: CreateModalStack,
  },
  {
    name: RootModalRoutes.DemoDoneModal,
    children: DoneModalStack,
  },
];

export default function DemoModalStackScreen() {
  return <RootModalNavigator<RootModalRoutes> config={modalStackScreenList} />;
}
