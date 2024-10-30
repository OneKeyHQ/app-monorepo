import type { ExecuteTransactionRequestType } from '@mysten/sui/client';

export type IEncodedTxSui = {
  rawTx: string;
  // TODO IFeeInfoUnit
  requestType?: ExecuteTransactionRequestType;
  sender: string;
};
