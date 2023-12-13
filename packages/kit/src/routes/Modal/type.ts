import type { IAccountManagerStacksParamList } from '../../views/AccountManagerStacks/types';
import type { IDiscoveryModalParamList } from '../../views/Discovery/router/Routes';
import type { IModalSettingParamList } from '../../views/Setting/types';
import type { IModalSwapParamList } from '../../views/Swap/router/Routers';
import type { ITestModalPagesParam } from '../../views/TestModal/router/type';

export enum EModalRoutes {
  DiscoveryModal = 'DiscoveryModal',
  SettingModal = 'SettingModal',
  TestModal = 'TestModal',
  SwapModal = 'SwapModal',
  AccountManagerStacks = 'AccountManagerStacks',
}

export type IModalParamList = {
  [EModalRoutes.TestModal]: ITestModalPagesParam;
  [EModalRoutes.DiscoveryModal]: IDiscoveryModalParamList;
  [EModalRoutes.SettingModal]: IModalSettingParamList;
  [EModalRoutes.SwapModal]: IModalSwapParamList;
  [EModalRoutes.AccountManagerStacks]: IAccountManagerStacksParamList;
};
