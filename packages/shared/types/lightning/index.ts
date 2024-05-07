import type { IUnionMsgType } from '@onekeyhq/core/src/chains/lightning/types';

import type { IInvoiceConfig, IInvoiceDecodedResponse } from './invoice';
import type { ILNURLPaymentSuccessAction } from './lnurl';
import type { IDevicePassphraseParams } from '../device';

export type * from './accounts';
export type * from './invoice';
export type * from './lnurl';

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
