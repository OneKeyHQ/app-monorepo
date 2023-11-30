import type { IModalTestParamList } from './TestModal/Routes';
import type { DiscoverModalParamList } from '../../../views/Discover/types';
import type { IModalSendParamList } from '../../../views/Send/types';
import type { IModalSettingParamList } from '../../../views/Setting/types';

export enum EModalRoutes {
  TestModal = 'TestModalStack',
  DiscoverModal = 'DiscoverModal',
  SettingModal = 'SettingModal',
  SendModal = 'SendModal',
}

export type IModalParamList = {
  [EModalRoutes.TestModal]: IModalTestParamList;
  [EModalRoutes.DiscoverModal]: DiscoverModalParamList;
  [EModalRoutes.SettingModal]: IModalSettingParamList;
  [EModalRoutes.SendModal]: IModalSendParamList;
};
