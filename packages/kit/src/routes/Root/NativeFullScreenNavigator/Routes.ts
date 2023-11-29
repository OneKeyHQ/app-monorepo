import type { IModalTestParamList } from './TestModal/Routes';

export enum ENativeFullScreenModalRoutes {
  NativeFullModal = 'NativeFullModal',
}

export type IFullScreenModalParamList = {
  [ENativeFullScreenModalRoutes.NativeFullModal]: IModalTestParamList;
};
