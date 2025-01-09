// @ts-ignore
import * as sdk from 'algosdk/dist/esm/index.js';

import type AccountInformation from 'algosdk/dist/types/client/v2/algod/accountAssetInformation';

export type {
  EncodedTransaction as ISdkAlgoEncodedTransaction,
  TransactionType as ISdkAlgoTransactionType,
  Transaction as ISdkAlgoTransaction,
  SuggestedParams as ISdkAlgoSuggestedParams,
} from 'algosdk';

export type IAlgoAccountInformation = {
  address: string;
  amount: number;
  assets: Array<{ amount: number; 'asset-id': number }>;
  'min-balance': number;
};

export type { AccountInformation as ISdkAlgoAccountInformation };

export default sdk as typeof import('algosdk');
