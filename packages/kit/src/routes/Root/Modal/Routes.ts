import type { ModalTestParamList } from './TestModal/Routes';
import type { DiscoverModalParamList } from '../../../views/Discover/types';

export enum ModalRoutes {
  TestModal = 'TestModalStack',
  DiscoverModal = 'DiscoverModal',
}

export type ModalParamList = {
  [ModalRoutes.TestModal]: ModalTestParamList;
  [ModalRoutes.DiscoverModal]: DiscoverModalParamList;
};
