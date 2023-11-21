import type { IModalRootNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import { RootModalNavigator } from '@onekeyhq/components/src/Navigation/Navigator';
import { ModalSettingStack } from '@onekeyhq/kit/src/views/Setting/Stack';

import { ModalDiscoverStack } from './Discover';
import { EModalRoutes } from './Routes';
import { ModalTestStack } from './TestModal/ModalTestStack';

const config: IModalRootNavigatorConfig<EModalRoutes>[] = [
  {
    name: EModalRoutes.TestModal,
    children: ModalTestStack,
  },
  {
    name: EModalRoutes.DiscoverModal,
    children: ModalDiscoverStack,
  },
  {
    name: EModalRoutes.SettingModal,
    children: ModalSettingStack,
  },
];

export default function ModalNavigator() {
  return <RootModalNavigator<EModalRoutes> config={config} />;
}
