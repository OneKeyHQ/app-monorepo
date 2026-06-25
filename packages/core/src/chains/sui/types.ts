import type { ExecuteTransactionRequestType } from '@mysten/sui/jsonRpc';

export type IEncodedTxSui = {
  rawTx: string;
  // TODO IFeeInfoUnit
  requestType?: ExecuteTransactionRequestType;
  sender: string;
};
