import type { ModalTestParamList } from './TestModal/Routes';

export enum ModalRoutes {
  TestModal = 'TestModalStack',
}

export type ModalParamList = {
  [ModalRoutes.TestModal]: ModalTestParamList;
};
