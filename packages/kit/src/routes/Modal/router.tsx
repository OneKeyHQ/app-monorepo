import type { IModalRootNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { ModalSettingStack } from '@onekeyhq/kit/src/views/Setting/router';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';

import { AccountManagerStacks } from '../../views/AccountManagerStacks/router';
import { ModalAddressBookRouter } from '../../views/AddressBook/router';
import { AppUpdateRouter } from '../../views/AppUpdate/router';
import { AssetSelectorRouter } from '../../views/AssetSelector/router';
import { ChainSelectorRouter } from '../../views/ChainSelector/router';
import { CloudBackupPages } from '../../views/CloudBackup/router';
import { DAppConnectionRouter } from '../../views/DAppConnection/router';
import { ModalDiscoveryStack } from '../../views/Discovery/router';
import { ModalFiatCryptoRouter } from '../../views/FiatCrypto/router';
import { ModalFirmwareUpdateStack } from '../../views/FirmwareUpdate/router';
import { KeyTagModalRouter } from '../../views/KeyTag/router';
import { LiteCardPages } from '../../views/LiteCard/router';
import { OnboardingRouter } from '../../views/Onboarding/router';
import { ModalReceiveStack } from '../../views/Receive/router';
import { ScanQrCodeModalRouter } from '../../views/ScanQrCode/router';
import { ModalSendStack } from '../../views/Send/router';
import { StakingModalRouter } from '../../views/Staking/router';
import { ModalSwapStack } from '../../views/Swap/router';
import { TestModalRouter } from '../../views/TestModal/router';
import { UniversalSearchRouter } from '../../views/UniversalSearch/router';
import { ModalWebViewStack } from '../../views/WebView/router';

import { ModalMainStack } from './Main';

const router: IModalRootNavigatorConfig<EModalRoutes>[] = [
  {
    name: EModalRoutes.MainModal,
    children: ModalMainStack,
  },
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
  {
    name: EModalRoutes.OnboardingModal,
    children: OnboardingRouter,
  },
  {
    name: EModalRoutes.FirmwareUpdateModal,
    children: ModalFirmwareUpdateStack,
  },
  {
    name: EModalRoutes.AssetSelectorModal,
    children: AssetSelectorRouter,
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
    name: EModalRoutes.ReceiveModal,
    children: ModalReceiveStack,
  },
  {
    name: EModalRoutes.DAppConnectionModal,
    children: DAppConnectionRouter,
  },
  {
    name: EModalRoutes.ScanQrCodeModal,
    children: ScanQrCodeModalRouter,
  },
  {
    name: EModalRoutes.LiteCardModal,
    children: LiteCardPages,
  },
  {
    name: EModalRoutes.CloudBackupModal,
    children: CloudBackupPages,
  },
  {
    name: EModalRoutes.WebViewModal,
    children: ModalWebViewStack,
  },
  {
    name: EModalRoutes.AddressBookModal,
    children: ModalAddressBookRouter,
  },
  {
    name: EModalRoutes.AppUpdateModal,
    children: AppUpdateRouter,
  },
  {
    name: EModalRoutes.FiatCryptoModal,
    children: ModalFiatCryptoRouter,
  },
  {
    name: EModalRoutes.KeyTagModal,
    children: KeyTagModalRouter,
  },
  {
    name: EModalRoutes.UniversalSearchModal,
    children: UniversalSearchRouter,
  },
  {
    name: EModalRoutes.StakingModal,
    children: StakingModalRouter,
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
