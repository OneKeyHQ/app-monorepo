import type { IModalTestParamList } from './TestModal/Routes';
import type { DiscoverModalParamList } from '../../../views/Discover/types';
import type { IModalSettingParamList } from '../../../views/Setting/types';
import type { IModalSwapParamList } from '../../../views/Swap/types';

export enum EModalRoutes {
  TestModal = 'TestModalStack',
  DiscoverModal = 'DiscoverModal',
  SettingModal = 'SettingModal',
  SwapModal = 'SwapModal',
}

export type IModalParamList = {
  [EModalRoutes.TestModal]: IModalTestParamList;
  [EModalRoutes.DiscoverModal]: DiscoverModalParamList;
  [EModalRoutes.SettingModal]: IModalSettingParamList;
  [EModalRoutes.SwapModal]: IModalSwapParamList;
};
