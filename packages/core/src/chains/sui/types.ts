import type { ExecuteTransactionRequestType } from '@mysten/sui.js';
import { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';

export type IEncodedTxSui = {
  rawTx: string;
  // TODO IFeeInfoUnit
  requestType?: ExecuteTransactionRequestType;
  sender: string;
};
