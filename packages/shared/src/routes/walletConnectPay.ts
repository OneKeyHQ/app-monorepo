import type { IWcPayCollectData } from '../walletConnect/payTypes';

export enum EModalWalletConnectPayRoutes {
  DataCollection = 'WalletConnectPayDataCollection',
}

export type IModalWalletConnectPayParamList = {
  [EModalWalletConnectPayRoutes.DataCollection]: {
    collectData: IWcPayCollectData;
    onComplete: () => void;
    onError: (error: string) => void;
    // user closed the form before completing it (not an error)
    onCancel: () => void;
  };
};
