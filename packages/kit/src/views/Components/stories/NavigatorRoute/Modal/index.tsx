import type { ModalRootNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import { RootModalNavigator } from '@onekeyhq/components/src/Navigation/Navigator';

import { CoverageModalStack } from './DemoCoverageModal';
import { CreateModalStack } from './DemoCreateModal';
import { LockedModalStack } from './DemoLockedModal';
import { RootModalRoutes } from './Routes';

const modalStackScreenList: ModalRootNavigatorConfig<RootModalRoutes>[] = [
  {
    name: RootModalRoutes.DemoCreateModal,
    children: CreateModalStack,
  },
  {
    name: RootModalRoutes.DemoLockedModal,
    children: LockedModalStack,
  },
  {
    name: RootModalRoutes.DemoCoverageModal,
    children: CoverageModalStack,
  },
];

export default function DemoModalStackScreen() {
  return <RootModalNavigator<RootModalRoutes> config={modalStackScreenList} />;
}
