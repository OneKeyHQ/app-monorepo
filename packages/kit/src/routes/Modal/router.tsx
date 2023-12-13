import type { IModalRootNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { ModalSettingStack } from '@onekeyhq/kit/src/views/Setting/Stack';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { AccountManagerStacks } from '../../views/AccountManagerStacks';
import { TestModalRouter } from '../../views/TestModal/router';

import { ModalDiscoveryStack } from './Discovery';
import { ModalSwapStack } from './SwapModalStack';
import { EModalRoutes } from './type';

const router: IModalRootNavigatorConfig<EModalRoutes>[] = [
  {
    name: EModalRoutes.DiscoveryModal,
    children: ModalDiscoveryStack,
  },
  {
    name: EModalRoutes.SettingModal,
    children: ModalSettingStack,
  },
  {
    name: EModalRoutes.SwapModal,
    children: ModalSwapStack,
  },
  {
    name: EModalRoutes.AccountManagerStacks,
    children: AccountManagerStacks,
  },
];

// Pages in Dev Mode
if (platformEnv.isDev) {
  router.push({
    name: EModalRoutes.TestModal,
    children: TestModalRouter,
  });
}

export const modalRouter = router;
