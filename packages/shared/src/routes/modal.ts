import type { IModalMarketParamList } from '@onekeyhq/kit/src/views/Market/router';

import type { IAccountManagerStacksParamList } from './accountManagerStacks';
import type { IModalAddressBookParamList } from './addressBook';
import type { IAppUpdatePagesParamList } from './appUpdate';
import type { IModalAssetDetailsParamList } from './assetDetails';
import type { IModalAssetListParamList } from './assetList';
import type { IAssetSelectorParamList } from './assetSelector';
import type { IModalBulkCopyAddressesParamList } from './bulkCopyAddresses';
import type { IChainSelectorParamList } from './chainSelector';
import type { ICloudBackupParamList } from './cloudBackup';
import type { IDAppConnectionModalParamList } from './dAppConnection';
import type { IModalDeviceManagementParamList } from './deviceManagement';
import type { IDiscoveryModalParamList } from './discovery';
import type { IModalFiatCryptoParamList } from './fiatCrypto';
import type { IModalFirmwareUpdateParamList } from './firmwareUpdate';
import type { IModalKeyTagParamList } from './keyTag';
import type { ILiteCardParamList } from './liteCard';
import type { IModalNotificationsParamList } from './notifications';
import type { IOnboardingParamList } from './onboarding';
import type { IPrimeParamList } from './prime';
import type { IModalReceiveParamList } from './receive';
import type { IModalReferFriendsParamList } from './referFriends';
import type { IModalRewardCenterParamList } from './rewardCenter';
import type { IScanQrCodeModalParamList } from './scanQrCode';
import type { IModalSendParamList } from './send';
import type { IModalSettingParamList } from './setting';
import type { IModalShortcutsParamList } from './shortcuts';
import type { IModalSignatureConfirmParamList } from './signatureConfirm';
import type { IModalStakingParamList } from './staking';
import type { IModalSwapParamList } from './swap';
import type { ITabHomeUrlAccountParamList } from './tabHome';
import type { ITestModalPagesParam } from './testModal';
import type { IUniversalSearchParamList } from './universalSearch';
import type { IModalWalletAddressParamList } from './walletAddress';
import type { IModalWebViewParamList } from './webView';

export enum EModalRoutes {
  MainModal = 'MainModal',
  DiscoveryModal = 'DiscoveryModal',
  SettingModal = 'SettingModal',
  TestModal = 'TestModal',
  SwapModal = 'SwapModal',
  MarketModal = 'MarketModal',
  AccountManagerStacks = 'AccountManagerStacks',
  OnboardingModal = 'OnboardingModal',
  PrimeModal = 'PrimeModal',
  FirmwareUpdateModal = 'FirmwareUpdateModal',
  AssetSelectorModal = 'AssetSelectorModal',
  ChainSelectorModal = 'ChainSelectorModal',
  SendModal = 'SendModal',
  ReceiveModal = 'ReceiveModal',
  ScanQrCodeModal = 'ScanQrCodeModal',
  LiteCardModal = 'LiteCardModal',
  CloudBackupModal = 'CloudBackupModal',
  WebViewModal = 'WebViewModal',
  AddressBookModal = 'AddressBookModal',
  DAppConnectionModal = 'DAppConnectionModal',
  AppUpdateModal = 'AppUpdateModal',
  FiatCryptoModal = 'FiatCryptoModal',
  KeyTagModal = 'KeyTagModal',
  UniversalSearchModal = 'UniversalSearchModal',
  StakingModal = 'StakingModal',
  WalletAddress = 'WalletAddress',
  NotificationsModal = 'NotificationsModal',
  ShortcutsModal = 'ShortcutsModal',
  SignatureConfirmModal = 'SignatureConfirmModal',
  DeviceManagementModal = 'DeviceManagementModal',
  ReferFriendsModal = 'ReferFriendsModal',
  BulkCopyAddressesModal = 'BulkCopyAddressesModal',
}

export type IModalParamList = {
  [EModalRoutes.AccountManagerStacks]: IAccountManagerStacksParamList;
  [EModalRoutes.AddressBookModal]: IModalAddressBookParamList;
  [EModalRoutes.AppUpdateModal]: IAppUpdatePagesParamList;
  [EModalRoutes.AssetSelectorModal]: IAssetSelectorParamList;
  [EModalRoutes.ChainSelectorModal]: IChainSelectorParamList;
  [EModalRoutes.CloudBackupModal]: ICloudBackupParamList;
  [EModalRoutes.DAppConnectionModal]: IDAppConnectionModalParamList;
  [EModalRoutes.DeviceManagementModal]: IModalDeviceManagementParamList;
  [EModalRoutes.DiscoveryModal]: IDiscoveryModalParamList;
  [EModalRoutes.FiatCryptoModal]: IModalFiatCryptoParamList;
  [EModalRoutes.FirmwareUpdateModal]: IModalFirmwareUpdateParamList;
  [EModalRoutes.KeyTagModal]: IModalKeyTagParamList;
  [EModalRoutes.LiteCardModal]: ILiteCardParamList;
  [EModalRoutes.MainModal]: IModalAssetListParamList &
    IModalAssetDetailsParamList &
    IModalRewardCenterParamList &
    ITabHomeUrlAccountParamList;
  [EModalRoutes.MarketModal]: IModalMarketParamList;
  [EModalRoutes.NotificationsModal]: IModalNotificationsParamList;
  [EModalRoutes.OnboardingModal]: IOnboardingParamList;
  [EModalRoutes.PrimeModal]: IPrimeParamList;
  [EModalRoutes.ReceiveModal]: IModalReceiveParamList;
  [EModalRoutes.ReferFriendsModal]: IModalReferFriendsParamList;
  [EModalRoutes.ScanQrCodeModal]: IScanQrCodeModalParamList;
  [EModalRoutes.SendModal]: IModalSendParamList;
  [EModalRoutes.SettingModal]: IModalSettingParamList;
  [EModalRoutes.ShortcutsModal]: IModalShortcutsParamList;
  [EModalRoutes.SignatureConfirmModal]: IModalSignatureConfirmParamList;
  [EModalRoutes.StakingModal]: IModalStakingParamList;
  [EModalRoutes.SwapModal]: IModalSwapParamList;
  [EModalRoutes.TestModal]: ITestModalPagesParam;
  [EModalRoutes.UniversalSearchModal]: IUniversalSearchParamList;
  [EModalRoutes.WalletAddress]: IModalWalletAddressParamList;
  [EModalRoutes.WebViewModal]: IModalWebViewParamList;
  [EModalRoutes.BulkCopyAddressesModal]: IModalBulkCopyAddressesParamList;
};
