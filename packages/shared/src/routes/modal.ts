import type { IAccountManagerStacksParamList } from './accountManagerStacks';
import type { IModalAddressBookParamList } from './addressBook';
import type { IAppUpdatePagesParamList } from './appUpdate';
import type { IModalAssetDetailsParamList } from './assetDetails';
import type { IModalAssetListParamList } from './assetList';
import type { IAssetSelectorParamList } from './assetSelector';
import type { IChainSelectorParamList } from './chainSelector';
import type { ICloudBackupParamList } from './cloudBackup';
import type { IDAppConnectionModalParamList } from './dAppConnection';
import type { IDiscoveryModalParamList } from './discovery';
import type { IModalFiatCryptoParamList } from './fiatCrypto';
import type { IModalFirmwareUpdateParamList } from './firmwareUpdate';
import type { IModalKeyTagParamList } from './keyTag';
import type { ILiteCardParamList } from './liteCard';
import type { IOnboardingParamList } from './onboarding';
import type { IModalReceiveParamList } from './receive';
import type { IScanQrCodeModalParamList } from './scanQrCode';
import type { IModalSendParamList } from './send';
import type { IModalSettingParamList } from './setting';
import type { IModalSwapParamList } from './swap';
import type { ITestModalPagesParam } from './testModal';
import type { IModalWebViewParamList } from './webView';

export enum EModalRoutes {
  MainModal = 'MainModal',
  DiscoveryModal = 'DiscoveryModal',
  SettingModal = 'SettingModal',
  TestModal = 'TestModal',
  SwapModal = 'SwapModal',
  AccountManagerStacks = 'AccountManagerStacks',
  OnboardingModal = 'OnboardingModal',
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
}

export type IModalParamList = {
  [EModalRoutes.MainModal]: IModalAssetListParamList &
    IModalAssetDetailsParamList;
  [EModalRoutes.TestModal]: ITestModalPagesParam;
  [EModalRoutes.DiscoveryModal]: IDiscoveryModalParamList;
  [EModalRoutes.SettingModal]: IModalSettingParamList;
  [EModalRoutes.SwapModal]: IModalSwapParamList;
  [EModalRoutes.AccountManagerStacks]: IAccountManagerStacksParamList;
  [EModalRoutes.OnboardingModal]: IOnboardingParamList;
  [EModalRoutes.FirmwareUpdateModal]: IModalFirmwareUpdateParamList;
  [EModalRoutes.AssetSelectorModal]: IAssetSelectorParamList;
  [EModalRoutes.ChainSelectorModal]: IChainSelectorParamList;
  [EModalRoutes.SendModal]: IModalSendParamList;
  [EModalRoutes.ReceiveModal]: IModalReceiveParamList;
  [EModalRoutes.ScanQrCodeModal]: IScanQrCodeModalParamList;
  [EModalRoutes.LiteCardModal]: ILiteCardParamList;
  [EModalRoutes.CloudBackupModal]: ICloudBackupParamList;
  [EModalRoutes.WebViewModal]: IModalWebViewParamList;
  [EModalRoutes.AddressBookModal]: IModalAddressBookParamList;
  [EModalRoutes.DAppConnectionModal]: IDAppConnectionModalParamList;
  [EModalRoutes.AppUpdateModal]: IAppUpdatePagesParamList;
  [EModalRoutes.FiatCryptoModal]: IModalFiatCryptoParamList;
  [EModalRoutes.KeyTagModal]: IModalKeyTagParamList;
};
