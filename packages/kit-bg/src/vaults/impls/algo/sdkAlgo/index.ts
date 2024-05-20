// @ts-ignore
import * as sdk from 'algosdk/dist/esm/index.js';

export type {
  EncodedTransaction as ISdkAlgoEncodedTransaction,
  TransactionType as ISdkAlgoTransactionType,
  Transaction as ISdkAlgoTransaction,
  SuggestedParams as ISdkAlgoSuggestedParams,
} from 'algosdk';

export default sdk as typeof import('algosdk');
