import type { IModalRootNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import { RootModalNavigator } from '@onekeyhq/components/src/Navigation/Navigator';
import { ModalSettingStack } from '@onekeyhq/kit/src/views/Setting/Stack';

import { ModalDiscoveryStack } from './Discovery';
import { EModalRoutes } from './Routes';
import { ModalTestStack } from './TestModal/ModalTestStack';

const config: IModalRootNavigatorConfig<EModalRoutes>[] = [
  {
    name: EModalRoutes.TestModal,
    children: ModalTestStack,
  },
  {
    name: EModalRoutes.DiscoveryModal,
    children: ModalDiscoveryStack,
  },
  {
    name: EModalRoutes.SettingModal,
    children: ModalSettingStack,
  },
];

export default function ModalNavigator() {
  return <RootModalNavigator<EModalRoutes> config={config} />;
}
