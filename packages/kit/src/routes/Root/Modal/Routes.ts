import type { IModalTestParamList } from './TestModal/Routes';
import type { IAccountManagerStacksParamList } from '../../../views/AccountManagerStacks/types';
import type { DiscoverModalParamList } from '../../../views/Discover/types';
import type { IModalSettingParamList } from '../../../views/Setting/types';

export enum EModalRoutes {
  TestModal = 'TestModalStack',
  DiscoverModal = 'DiscoverModal',
  SettingModal = 'SettingModal',
  AccountManagerStacks = 'AccountManagerStacks',
}

export type IModalParamList = {
  [EModalRoutes.TestModal]: IModalTestParamList;
  [EModalRoutes.DiscoverModal]: DiscoverModalParamList;
  [EModalRoutes.SettingModal]: IModalSettingParamList;
  [EModalRoutes.AccountManagerStacks]: IAccountManagerStacksParamList;
};
