import type { IModalRootNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { ENativeFullScreenModalRoutes } from './Routes';
import { FullTestModalStack } from './TestModal/FullScreenModalStack';

const config: IModalRootNavigatorConfig<ENativeFullScreenModalRoutes>[] = [
  {
    name: ENativeFullScreenModalRoutes.NativeFullModal,
    children: FullTestModalStack,
  },
];

export default function ModalNavigator() {
  return <RootModalNavigator<ENativeFullScreenModalRoutes> config={config} />;
}
