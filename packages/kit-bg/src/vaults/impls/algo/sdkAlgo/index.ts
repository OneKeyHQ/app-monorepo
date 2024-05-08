// @ts-ignore
import * as sdk from 'algosdk/dist/esm/index.js';

export type {
  EncodedTransaction as ISdkAlgoEncodedTransaction,
  TransactionType as ISdkAlgoTransactionType,
  Transaction as ISdkAlgoTransaction,
} from 'algosdk';

export default sdk as typeof import('algosdk');
