import { IModalSwapParamList } from '@onekeyhq/kit/src/views/Swap/router/types';
import type { IAccountManagerStacksParamList } from './accountManagerStacks';
import type { IModalAddressBookParamList } from './addressBook';
import type { IModalAssetDetailsParamList } from './assetDetails';
import type { IModalAssetListParamList } from './assetList';
import type { IAssetSelectorParamList } from './assetSelector';
import type { IChainSelectorParamList } from './chainSelector';
import type { IDAppConnectionModalParamList } from './dAppConnection';
import type { IDiscoveryModalParamList } from './discovery';
import type { ILiteCardParamList } from './liteCard';
import type { IOnboardingParamList } from './onboarding';
import type { IModalReceiveParamList } from './receive';
import type { IScanQrCodeModalParamList } from './scanQrCode';
import type { IModalSendParamList } from './send';
import type { IModalSettingParamList } from './setting';
import type { ITestModalPagesParam } from './testModal';

export enum EModalRoutes {
  MainModal = 'MainModal',
  DiscoveryModal = 'DiscoveryModal',
  SettingModal = 'SettingModal',
  TestModal = 'TestModal',
  SwapModal = 'SwapModal',
  AccountManagerStacks = 'AccountManagerStacks',
  OnboardingModal = 'OnboardingModal',
  AssetSelectorModal = 'AssetSelectorModal',
  ChainSelectorModal = 'ChainSelectorModal',
  SendModal = 'SendModal',
  ReceiveModal = 'ReceiveModal',
  ScanQrCodeModal = 'ScanQrCodeModal',
  LiteCardModal = 'LiteCardModal',
  AddressBookModal = 'AddressBookModal',
  DAppConnectionModal = 'DAppConnectionModal',
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
  [EModalRoutes.AssetSelectorModal]: IAssetSelectorParamList;
  [EModalRoutes.ChainSelectorModal]: IChainSelectorParamList;
  [EModalRoutes.SendModal]: IModalSendParamList;
  [EModalRoutes.ReceiveModal]: IModalReceiveParamList;
  [EModalRoutes.ScanQrCodeModal]: IScanQrCodeModalParamList;
  [EModalRoutes.LiteCardModal]: ILiteCardParamList;
  [EModalRoutes.AddressBookModal]: IModalAddressBookParamList;
  [EModalRoutes.DAppConnectionModal]: IDAppConnectionModalParamList;
};
