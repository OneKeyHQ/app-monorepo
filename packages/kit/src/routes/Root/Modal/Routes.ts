import type { IModalTestParamList } from './TestModal/Routes';
import type { IDiscoveryModalParamList } from '../../../views/Discovery/router/Routes';

export enum EModalRoutes {
  TestModal = 'TestModalStack',
  DiscoveryModal = 'DiscoveryModal',
}

export type IModalParamList = {
  [EModalRoutes.TestModal]: IModalTestParamList;
  [EModalRoutes.DiscoveryModal]: IDiscoveryModalParamList;
};
