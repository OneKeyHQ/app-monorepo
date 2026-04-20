import type { IModalRootNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { ModalSettingStack } from '@onekeyhq/kit/src/views/Setting/router';
import {
  isOnBoardingOpenAtom,
  v4migrationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EOnboardingV2Routes } from '@onekeyhq/shared/src/routes';
import type { EFullScreenPushRoutes } from '@onekeyhq/shared/src/routes/fullScreenPush';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { keylessOnboardingCache } from '../../components/KeylessWallet/useKeylessWallet';
import { AccountManagerStacks } from '../../views/AccountManagerStacks/router';
// [ONBOARDING-DEV] import { ActionCenterRouter } from '../../views/ActionCenter/router';
// [ONBOARDING-DEV] import { ModalAddressBookRouter } from '../../views/AddressBook/router';
// [ONBOARDING-DEV] import { ModalApprovalManagementStack } from '../../views/ApprovalManagement/router';
// [ONBOARDING-DEV] import { AppUpdateRouter } from '../../views/AppUpdate/router';
import { AssetSelectorRouter } from '../../views/AssetSelector/router';
// [ONBOARDING-DEV] import { BulkCopyAddressesModalRouter } from '../../views/BulkCopyAddresses/router';
// [ONBOARDING-DEV] import { BulkSendModalRouter } from '../../views/BulkSend/router';
import { ChainSelectorRouter } from '../../views/ChainSelector/router';
import { CloudBackupPages } from '../../views/CloudBackup/router';
// [ONBOARDING-DEV] import { DAppConnectionRouter } from '../../views/DAppConnection/router';
import { DeviceManagementStacks } from '../../views/DeviceManagement/router';
// [ONBOARDING-DEV] import { ModalDiscoveryStack } from '../../views/Discovery/router';
// [ONBOARDING-DEV] import { ModalFiatCryptoRouter } from '../../views/FiatCrypto/router';
import { ModalFirmwareUpdateStack } from '../../views/FirmwareUpdate/router';
import { KeyTagModalRouter } from '../../views/KeyTag/router';
// [ONBOARDING-DEV] import { LiteCardPages } from '../../views/LiteCard/router';
// [ONBOARDING-DEV] import { ManualBackupRouter } from '../../views/ManualBackup/router';
// [ONBOARDING-DEV] import { ModalMarketStack } from '../../views/Market/router';
// [ONBOARDING-DEV] import { NetworkDoctorModalRouter } from '../../views/NetworkDoctor/router';
// [ONBOARDING-DEV] import { ModalNotificationsRouter } from '../../views/Notifications/router';
import { OnboardingRouter } from '../../views/Onboarding/router';
import { OnboardingRouterV2 } from '../../views/Onboardingv2/router';
// [ONBOARDING-DEV] import { ModalPerpStack } from '../../views/Perp/router';
// [ONBOARDING-DEV] import { PrimeRouter } from '../../views/Prime/router';
// [ONBOARDING-DEV] import { ModalReceiveStack } from '../../views/Receive/router';
// [ONBOARDING-DEV] import { ReferFriendsRouter } from '../../views/ReferFriends/router';
import { ScanQrCodeModalRouter } from '../../views/ScanQrCode/router';
// [ONBOARDING-DEV] import { ModalSendStack } from '../../views/Send/router';
// [ONBOARDING-DEV] import { ShortcutsModalRouter } from '../../views/Shortcuts/router';
// [ONBOARDING-DEV] import { ModalSignAndVerifyRouter } from '../../views/SignAndVerifyMessage/router';
// [ONBOARDING-DEV] import { ModalSignatureConfirmStack } from '../../views/SignatureConfirm/router';
// [ONBOARDING-DEV] import { StakingModalRouter } from '../../views/Staking/router';
// [ONBOARDING-DEV] import { ModalSwapStack } from '../../views/Swap/router';
// [ONBOARDING-DEV] import { TestModalRouter } from '../../views/TestModal/router';
// [ONBOARDING-DEV] import { UniversalSearchRouter } from '../../views/UniversalSearch/router';
// [ONBOARDING-DEV] import { WalletAddressModalRouter } from '../../views/WalletAddress/router';
// [ONBOARDING-DEV] import { ModalWebViewStack } from '../../views/WebView/router';

import { ModalMainStack } from './Main';

const onboardingRouterConfig = {
  onMounted: () => {
    console.log('OnboardingModal onMounted');
  },
  onUnmounted: async () => {
    await v4migrationAtom.set((v) => ({
      ...v,
      isProcessing: false,
      isMigrationModalOpen: false,
    }));
    console.log('OnboardingModal onUnmounted');
    await backgroundApiProxy.serviceV4Migration.clearV4MigrationPayload();
  },
  name: EModalRoutes.OnboardingModal,
  children: OnboardingRouter,
};

const router: IModalRootNavigatorConfig<EModalRoutes>[] = [
  {
    name: EModalRoutes.MainModal,
    children: ModalMainStack,
  },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.DiscoveryModal,
  // [ONBOARDING-DEV]   children: ModalDiscoveryStack,
  // [ONBOARDING-DEV] },
  {
    name: EModalRoutes.SettingModal,
    children: ModalSettingStack,
    rewrite: '/settings',
    exact: true,
  },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.SwapModal,
  // [ONBOARDING-DEV]   children: ModalSwapStack,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.PerpModal,
  // [ONBOARDING-DEV]   children: ModalPerpStack,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.MarketModal,
  // [ONBOARDING-DEV]   children: ModalMarketStack,
  // [ONBOARDING-DEV] },
  {
    name: EModalRoutes.AccountManagerStacks,
    children: AccountManagerStacks,
    async onUnmounted() {
      void backgroundApiProxy.serviceBatchCreateAccount.clearNetworkAccountCache();
      // void backgroundApiProxy.serviceBatchCreateAccount.cancelBatchCreateAccountsFlow();
    },
    async onMounted() {
      void backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlowSilentlyThrottled(
        {
          callerName: 'AccountManagerStacks onMounted',
        },
      );
    },
  },
  onboardingRouterConfig,
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.PrimeModal,
  // [ONBOARDING-DEV]   children: PrimeRouter,
  // [ONBOARDING-DEV]   onUnmounted() {
  // [ONBOARDING-DEV]     void backgroundApiProxy.servicePrimeTransfer.clearSensitiveData();
  // [ONBOARDING-DEV]   },
  // [ONBOARDING-DEV] },
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
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.SendModal,
  // [ONBOARDING-DEV]   children: ModalSendStack,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.SignatureConfirmModal,
  // [ONBOARDING-DEV]   children: ModalSignatureConfirmStack,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.ReceiveModal,
  // [ONBOARDING-DEV]   children: ModalReceiveStack,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.DAppConnectionModal,
  // [ONBOARDING-DEV]   children: DAppConnectionRouter,
  // [ONBOARDING-DEV] },
  {
    name: EModalRoutes.ScanQrCodeModal,
    children: ScanQrCodeModalRouter,
  },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.LiteCardModal,
  // [ONBOARDING-DEV]   children: LiteCardPages,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.ManualBackupModal,
  // [ONBOARDING-DEV]   children: ManualBackupRouter,
  // [ONBOARDING-DEV] },
  {
    name: EModalRoutes.CloudBackupModal,
    children: CloudBackupPages,
  },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.WebViewModal,
  // [ONBOARDING-DEV]   children: ModalWebViewStack,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.AddressBookModal,
  // [ONBOARDING-DEV]   children: ModalAddressBookRouter,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.AppUpdateModal,
  // [ONBOARDING-DEV]   rewrite: '/update',
  // [ONBOARDING-DEV]   children: AppUpdateRouter,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.FiatCryptoModal,
  // [ONBOARDING-DEV]   children: ModalFiatCryptoRouter,
  // [ONBOARDING-DEV] },
  {
    name: EModalRoutes.KeyTagModal,
    children: KeyTagModalRouter,
  },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.UniversalSearchModal,
  // [ONBOARDING-DEV]   children: UniversalSearchRouter,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.StakingModal,
  // [ONBOARDING-DEV]   children: StakingModalRouter,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.WalletAddress,
  // [ONBOARDING-DEV]   children: WalletAddressModalRouter,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.NotificationsModal,
  // [ONBOARDING-DEV]   children: ModalNotificationsRouter,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.ShortcutsModal,
  // [ONBOARDING-DEV]   children: ShortcutsModalRouter,
  // [ONBOARDING-DEV] },
  {
    name: EModalRoutes.DeviceManagementModal,
    children: DeviceManagementStacks,
  },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.ReferFriendsModal,
  // [ONBOARDING-DEV]   children: ReferFriendsRouter,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.BulkCopyAddressesModal,
  // [ONBOARDING-DEV]   children: BulkCopyAddressesModalRouter,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.BulkSendModal,
  // [ONBOARDING-DEV]   children: BulkSendModalRouter,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.ApprovalManagementModal,
  // [ONBOARDING-DEV]   children: ModalApprovalManagementStack,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.SignAndVerifyModal,
  // [ONBOARDING-DEV]   children: ModalSignAndVerifyRouter,
  // [ONBOARDING-DEV] },
  // [ONBOARDING-DEV] {
  // [ONBOARDING-DEV]   name: EModalRoutes.NetworkDoctorModal,
  // [ONBOARDING-DEV]   children: NetworkDoctorModalRouter,
  // [ONBOARDING-DEV] },
];

// [ONBOARDING-DEV] Pages in Dev Mode
// [ONBOARDING-DEV] if (platformEnv.isDev) {
// [ONBOARDING-DEV]   router.push({
// [ONBOARDING-DEV]     name: EModalRoutes.TestModal,
// [ONBOARDING-DEV]     children: TestModalRouter,
// [ONBOARDING-DEV]   });
// [ONBOARDING-DEV] }

export const modalRouter = router;

// [ONBOARDING-DEV] fullModalRouter disabled - no iOS full-screen modals needed
export const fullModalRouter: IModalRootNavigatorConfig<EModalRoutes>[] = [];

// [ONBOARDING-DEV] fullScreenPushRouterConfig disabled - no ActionCenter needed
export const fullScreenPushRouterConfig: IModalRootNavigatorConfig<EFullScreenPushRoutes>[] =
  [];

export const onboardingRouterV2Config: IModalRootNavigatorConfig<EOnboardingV2Routes>[] =
  [
    {
      onMounted: () => {
        console.log('OnboardingModal onMounted');
        void isOnBoardingOpenAtom.set(true);
      },
      onUnmounted: async () => {
        void isOnBoardingOpenAtom.set(false);
        keylessOnboardingCache.clear();
        try {
          await backgroundApiProxy.serviceKeylessWallet.clearKeylessOnboardingCache();
        } catch {
          // ignore
        }
        await v4migrationAtom.set((v) => ({
          ...v,
          isProcessing: false,
          isMigrationModalOpen: false,
        }));
        console.log('OnboardingModal onUnmounted');
        await backgroundApiProxy.serviceV4Migration.clearV4MigrationPayload();
      },
      name: EOnboardingV2Routes.OnboardingV2,
      rewrite: '/onboarding',
      exact: true,
      children: OnboardingRouterV2,
    },
  ];
