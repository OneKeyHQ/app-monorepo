import type { DiscoverModalParamList } from '../../views/Discover/types';
import type { IModalSettingParamList } from '../../views/Setting/types';
import type { ITestModalPagesParam } from '../../views/TestModal/router/type';

export enum EModalRoutes {
  DiscoverModal = 'DiscoverModal',
  SettingModal = 'SettingModal',
  TestModal = 'TestModal',
}

export type IModalParamList = {
  [EModalRoutes.TestModal]: ITestModalPagesParam;
  [EModalRoutes.DiscoverModal]: DiscoverModalParamList;
  [EModalRoutes.SettingModal]: IModalSettingParamList;
};
