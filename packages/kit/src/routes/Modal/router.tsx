import type { IModalRootNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { ModalSettingStack } from '@onekeyhq/kit/src/views/Setting/Stack';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { AccountManagerStacks } from '../../views/AccountManagerStacks';
import { ChainSelectorRouter } from '../../views/ChainSelector/router';
import { OnboardingRouter } from '../../views/Onboarding/router';
import { TestModalRouter } from '../../views/TestModal/router';

import { ModalDiscoveryStack } from './Discovery';
import { ModalSendStack } from './Send';
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
    name: EModalRoutes.AccountManagerStacks,
    children: AccountManagerStacks,
  },
  {
    name: EModalRoutes.OnboardingModal,
    children: OnboardingRouter,
  },
  {
    name: EModalRoutes.ChainSelectorModal,
    children: ChainSelectorRouter,
  },
  {
    name: EModalRoutes.SendModal,
    children: ModalSendStack,
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
