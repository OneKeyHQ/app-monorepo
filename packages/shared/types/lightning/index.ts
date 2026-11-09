import type { IUnionMsgType } from '@onekeyhq/core/src/chains/lightning/types';

import type { IInvoiceConfig, IInvoiceDecodedResponse } from './invoice';
import type {
  ILNURLAuthServiceResponse,
  ILNURLPaymentSuccessAction,
} from './lnurl';
import type {
  IDevicePassphraseParams,
  IDeviceSharedCallParams,
} from '../device';

export type * from './accounts';
export type * from './invoice';
export type * from './lnurl';

export enum ELightningUnit {
  BTC = 'btc',
  SATS = 'sats',
}

export type ISignApiMessageParams = {
  msgPayload: IUnionMsgType;
  address: string;
  path: string;
  password?: string;
  connectId?: string;
  deviceId?: string;
  deviceCommonParams?: IDevicePassphraseParams | undefined;
};

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

/**
 * A Lightning Self-Custody (Breez Spark) payment of a BOLT11 invoice. The
 * fields come from the OneKey lightning service's decode of `invoice`, which
 * the confirm page shows; the device pays it with the Breez SDK only after
 * the SDK's own parse matches them.
 */
export type IEncodedTxLightningSpark = {
  invoice: string;
  paymentHash: string;
  // The invoice's own amount. An invoice without an amount has none and
  // pays amountSats, the amount the user entered.
  amountMillisatoshis?: string;
  amountSats: string;
  description?: string;
  // Unix seconds.
  expiresAt?: number;
  // The fee the user approved on the confirm page; the send refuses a
  // higher quote.
  maxFeeSats?: string;
  // The Lightning address the user entered, when the invoice came from its
  // LNURL callback. Display only.
  lightningAddress?: string;
};

export type ILnurlAuthParams = {
  lnurlDetail: ILNURLAuthServiceResponse;
  password?: string;
  deviceParams?: IDeviceSharedCallParams;
};
