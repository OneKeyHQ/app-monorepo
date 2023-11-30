import type { IModalRootNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { ModalSettingStack } from '@onekeyhq/kit/src/views/Setting/Stack';

import { ModalDiscoverStack } from './Discover';
import { EModalRoutes } from './Routes';
import { ModalSendStack } from './Send';
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
  {
    name: EModalRoutes.SendModal,
    children: ModalSendStack,
  },
];

export default function ModalNavigator() {
  return <RootModalNavigator<EModalRoutes> config={config} />;
}
