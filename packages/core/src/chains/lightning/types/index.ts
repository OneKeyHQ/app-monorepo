import type { IInvoiceConfig, IInvoiceDecodedResponse } from './invoice';
import type { ILNURLPaymentSuccessAction } from './lnurl';

export type IEncodedTxLightning = {
  invoice: string;
  paymentHash: string;
  amount: string;
  expired: string;
  created: string;
  lightningAddress?: string;
  description?: string;
  fee: number;
  isExceedTransferLimit: boolean;
  config: IInvoiceConfig;
  successAction?: ILNURLPaymentSuccessAction;
  decodedInvoice?: IInvoiceDecodedResponse;
};

// export type ILightningHDSignatureParams = {
//   msgPayload: UnionMsgType;
//   engine: Engine;
//   path: string;
//   password: string;
//   entropy: Buffer;
//   isTestnet: boolean;
// };

// export type ILightningHWSIgnatureParams = {
//   msgPayload: UnionMsgType;
//   path: string;
//   isTestnet: boolean;
// };
