import type { IAccountManagerStacksParamList } from '../../views/AccountManagerStacks/types';
import type { IDiscoveryModalParamList } from '../../views/Discovery/router/Routes';
import type { IModalSettingParamList } from '../../views/Setting/types';
import type { ITestModalPagesParam } from '../../views/TestModal/router/type';

export enum EModalRoutes {
  DiscoveryModal = 'DiscoveryModal',
  SettingModal = 'SettingModal',
  TestModal = 'TestModal',
  AccountManagerStacks = 'AccountManagerStacks',
}

export type IModalParamList = {
  [EModalRoutes.TestModal]: ITestModalPagesParam;
  [EModalRoutes.DiscoveryModal]: IDiscoveryModalParamList;
  [EModalRoutes.SettingModal]: IModalSettingParamList;
  [EModalRoutes.AccountManagerStacks]: IAccountManagerStacksParamList;
};
