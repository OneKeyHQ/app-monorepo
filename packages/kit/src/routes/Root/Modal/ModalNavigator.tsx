import type { ModalRootNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import { RootModalNavigator } from '@onekeyhq/components/src/Navigation/Navigator';

import { ModalDiscoverStack } from './Discover';
import { ModalRoutes } from './Routes';
import { ModalTestStack } from './TestModal/ModalTestStack';

const config: ModalRootNavigatorConfig<ModalRoutes>[] = [
  {
    name: ModalRoutes.TestModal,
    children: ModalTestStack,
  },
  {
    name: ModalRoutes.DiscoverModal,
    children: ModalDiscoverStack,
  },
];

export default function ModalNavigator() {
  return <RootModalNavigator<ModalRoutes> config={config} />;
}
