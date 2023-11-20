import type { IModalTestParamList } from './TestModal/Routes';
import type { IDiscoveryModalParamList } from '../../../views/Discovery/router/Routes';
import type { IModalSettingParamList } from '../../../views/Setting/types';

export enum EModalRoutes {
  TestModal = 'TestModalStack',
  DiscoveryModal = 'DiscoveryModal',
  SettingModal = 'SettingModal',
}

export type IModalParamList = {
  [EModalRoutes.TestModal]: IModalTestParamList;
  [EModalRoutes.DiscoveryModal]: IDiscoveryModalParamList;
  [EModalRoutes.SettingModal]: IModalSettingParamList;
};
