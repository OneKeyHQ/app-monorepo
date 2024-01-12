import type { IModalRootNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { ModalSettingStack } from '@onekeyhq/kit/src/views/Setting/router';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { AccountManagerStacks } from '../../views/AccountManagerStacks';
import { ChainSelectorRouter } from '../../views/ChainSelector/router';
import { OnboardingRouter } from '../../views/Onboarding/router';
import { ScanQrCodeModalRouter } from '../../views/ScanQrCode/router';
import { TestModalRouter } from '../../views/TestModal/router';
import { TokenRouter } from '../../views/Token/router';
import { WalletConnectRouter } from '../../views/WalletConnect/router';

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
  {
    name: EModalRoutes.WalletConnectModal,
    children: WalletConnectRouter,
  },
  {
    name: EModalRoutes.TokenModal,
    children: TokenRouter,
  },
  {
    name: EModalRoutes.ScanQrCodeModal,
    children: ScanQrCodeModalRouter,
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
