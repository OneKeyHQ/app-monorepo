// @ts-ignore algosdk does not publish typings for the ESM bundle entry; Rspack needs the namespace import shape.
import * as sdk from 'algosdk/dist/esm/index.js';

export type {
  EncodedTransaction as ISdkAlgoEncodedTransaction,
  Transaction as ISdkAlgoTransaction,
  TransactionType as ISdkAlgoTransactionType,
} from 'algosdk';

export default sdk as typeof import('algosdk');
