import type {
  IWcPayCollectData,
  IWcPayConfirmResult,
} from '../walletConnect/payTypes';

export enum EModalWalletConnectPayRoutes {
  PaymentOptions = 'WalletConnectPayPaymentOptions',
  DataCollection = 'WalletConnectPayDataCollection',
  PaymentResult = 'WalletConnectPayPaymentResult',
}

export type IModalWalletConnectPayParamList = {
  [EModalWalletConnectPayRoutes.PaymentOptions]: {
    paymentLink: string;
  };
  [EModalWalletConnectPayRoutes.DataCollection]: {
    collectData: IWcPayCollectData;
    onComplete: () => void;
    onError: (error: string) => void;
    // user closed the form before completing it (not an error)
    onCancel: () => void;
  };
  [EModalWalletConnectPayRoutes.PaymentResult]: {
    paymentId: string;
    optionId: string;
    signatures: string[];
    initialResult: IWcPayConfirmResult;
  };
};
