import type { IModalTestParamList } from './TestModal/Routes';
import type { DiscoverModalParamList } from '../../../views/Discover/types';

export enum EModalRoutes {
  TestModal = 'TestModalStack',
  DiscoverModal = 'DiscoverModal',
}

export type IModalParamList = {
  [EModalRoutes.TestModal]: IModalTestParamList;
  [EModalRoutes.DiscoverModal]: DiscoverModalParamList;
};
