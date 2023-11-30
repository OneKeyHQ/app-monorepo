import type { IIOSFullScreenTestModalPagesParam } from '../../views/iOSFullScreenTestModal/router/type';

export enum EIOSFullScreenModalRoutes {
  iOSFullScreenTestModal = 'iOSFullScreenTestModal',
}

export type IIOSFullScreenModalParamList = {
  [EIOSFullScreenModalRoutes.iOSFullScreenTestModal]: IIOSFullScreenTestModalPagesParam;
};
