import type { IModalRootNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { ModalSettingStack } from '@onekeyhq/kit/src/views/Setting/router';
import { v4migrationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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

// packages/kit/src/provider/Container/QrcodeDialogContainer/QrcodeDialogContainer.tsx 32L
function appendDefaultModalStack<T>(originStacks: T) {
  return [...(originStacks as []), ...ScanQrCodeModalRouter] as T;
}
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
    children: appendDefaultModalStack(ModalSwapStack),
  },
  {
    name: EModalRoutes.AccountManagerStacks,
    children: AccountManagerStacks,
  },
  {
    onMounted: () => {
      console.log('OnboardingModal onMounted');
    },
    onUnmounted: async () => {
      await v4migrationAtom.set((v) => ({ ...v, isMigrationModalOpen: false }));
      console.log('OnboardingModal onUnmounted');
    },
    name: EModalRoutes.OnboardingModal,
    children: appendDefaultModalStack(OnboardingRouter),
  },
  {
    name: EModalRoutes.FirmwareUpdateModal,
    children: appendDefaultModalStack(ModalFirmwareUpdateStack),
  },
  {
    name: EModalRoutes.AssetSelectorModal,
    children: appendDefaultModalStack(AssetSelectorRouter),
  },
  {
    name: EModalRoutes.ChainSelectorModal,
    children: ChainSelectorRouter,
  },
  {
    name: EModalRoutes.SendModal,
    children: appendDefaultModalStack(ModalSendStack),
  },
  {
    name: EModalRoutes.ReceiveModal,
    children: appendDefaultModalStack(ModalReceiveStack),
  },
  {
    name: EModalRoutes.DAppConnectionModal,
    children: appendDefaultModalStack(DAppConnectionRouter),
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
    children: appendDefaultModalStack(StakingModalRouter),
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
