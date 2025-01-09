import type { ExecuteTransactionRequestType } from '@benfen/bfc.js/client';

export type IEncodedTxBfc = {
  rawTx: string;
  // TODO IFeeInfoUnit
  requestType?: ExecuteTransactionRequestType;
  sender: string;
};
