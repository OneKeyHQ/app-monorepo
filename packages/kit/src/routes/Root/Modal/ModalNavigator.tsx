import type { ModalRootNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import { RootModalNavigator } from '@onekeyhq/components/src/Navigation/Navigator';

import { ModalRoutes } from './Routes';
import { ModalTestStack } from './TestModal/ModalTestStack';

const config: ModalRootNavigatorConfig<ModalRoutes>[] = [
  {
    name: ModalRoutes.TestModal,
    children: ModalTestStack,
  },
];

export default function ModalNavigator() {
  return <RootModalNavigator<ModalRoutes> config={config} />;
}
