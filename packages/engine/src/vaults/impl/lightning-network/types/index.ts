import type { Engine } from '@onekeyhq/engine/src/index';

import type { UnionMsgType } from '../helper/signature';
import type { IInvoiceConfig } from './invoice';
import type { LNURLPaymentSuccessAction } from './lnurl';

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
  successAction?: LNURLPaymentSuccessAction;
};

export type ILightningHDSignatureParams = {
  msgPayload: UnionMsgType;
  engine: Engine;
  path: string;
  password: string;
  entropy: Buffer;
  isTestnet: boolean;
};

export type ILightningHWSIgnatureParams = {
  msgPayload: UnionMsgType;
  path: string;
  isTestnet: boolean;
};
