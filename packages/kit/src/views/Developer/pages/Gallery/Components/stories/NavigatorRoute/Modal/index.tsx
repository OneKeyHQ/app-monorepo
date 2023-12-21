import type { IModalRootNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { CoverageModalStack } from './DemoCoverageModal';
import { CreateModalStack } from './DemoCreateModal';
import { LockedModalStack } from './DemoLockedModal';
import { ERootModalRoutes } from './Routes';

const modalGalleryScreenList: IModalRootNavigatorConfig<ERootModalRoutes>[] = [
  {
    name: ERootModalRoutes.DemoCreateModal,
    children: CreateModalStack,
  },
  {
    name: ERootModalRoutes.DemoLockedModal,
    children: LockedModalStack,
  },
  {
    name: ERootModalRoutes.DemoCoverageModal,
    children: CoverageModalStack,
  },
];

export default function DemoModalStackScreen() {
  return (
    <RootModalNavigator<ERootModalRoutes> config={modalGalleryScreenList} />
  );
}
