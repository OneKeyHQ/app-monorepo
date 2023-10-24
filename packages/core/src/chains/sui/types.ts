import type { ExecuteTransactionRequestType } from '@mysten/sui.js';

export type IEncodedTxSui = {
  rawTx: string;
  // TODO IFeeInfoUnit
  requestType?: ExecuteTransactionRequestType;
};
