import type { IAccountManagerStacksParamList } from '../../views/AccountManagerStacks/types';
import type { IChainSelectorParamList } from '../../views/ChainSelector/router/type';
import type { IDiscoveryModalParamList } from '../../views/Discovery/router/Routes';
import type { INFTParamList } from '../../views/NFT/router/type';
import type { IOnboardingParamList } from '../../views/Onboarding/router/type';
import type { IReceiveParamList } from '../../views/Receive/router/type';
import type { IModalSendParamList } from '../../views/Send/router';
import type { IModalSettingParamList } from '../../views/Setting/types';
import type { ITestModalPagesParam } from '../../views/TestModal/router/type';
import type { ITokenParamList } from '../../views/Token/router/type';

export enum EModalRoutes {
  DiscoveryModal = 'DiscoveryModal',
  SettingModal = 'SettingModal',
  TestModal = 'TestModal',
  AccountManagerStacks = 'AccountManagerStacks',
  OnboardingModal = 'OnboardingModal',
  ChainSelectorModal = 'ChainSelectorModal',
  SendModal = 'SendModal',
  ReceiveModal = 'ReceiveModal',
  TokenModal = 'TokenModal',
  NFTModal = 'NFTModal',
}

export type IModalParamList = {
  [EModalRoutes.TestModal]: ITestModalPagesParam;
  [EModalRoutes.DiscoveryModal]: IDiscoveryModalParamList;
  [EModalRoutes.SettingModal]: IModalSettingParamList;
  [EModalRoutes.AccountManagerStacks]: IAccountManagerStacksParamList;
  [EModalRoutes.OnboardingModal]: IOnboardingParamList;
  [EModalRoutes.ChainSelectorModal]: IChainSelectorParamList;
  [EModalRoutes.SendModal]: IModalSendParamList;
  [EModalRoutes.ReceiveModal]: IReceiveParamList;
  [EModalRoutes.TokenModal]: ITokenParamList;
  [EModalRoutes.NFTModal]: INFTParamList;
};
