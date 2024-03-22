// import type { IInvoiceConfig } from './invoice';
// import type { LNURLPaymentSuccessAction } from './lnurl';
import type { ISigner } from '../../../base/ChainSigner';
import type { IUnionMsgType } from '../sdkLightning/signature';

// export type IEncodedTxLightning = {
//   invoice: string;
//   paymentHash: string;
//   amount: string;
//   expired: string;
//   created: string;
//   lightningAddress?: string;
//   description?: string;
//   fee: number;
//   isExceedTransferLimit: boolean;
//   config: IInvoiceConfig;
//   successAction?: LNURLPaymentSuccessAction;
// };

export type ILightningHDSignatureParams = {
  msgPayload: IUnionMsgType;
  signer: ISigner;
  isTestnet: boolean;
};

export type ILightningHWSIgnatureParams = {
  msgPayload: IUnionMsgType;
  path: string;
  isTestnet: boolean;
};
