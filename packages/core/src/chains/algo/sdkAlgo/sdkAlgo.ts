// import * as sdk from 'algosdk/dist/esm/index.js';
// export default sdk as typeof import('algosdk');

import sdk from 'algosdk';

export type {
  EncodedTransaction as ISdkAlgoEncodedTransaction,
  Transaction as ISdkAlgoTransaction,
  TransactionType as ISdkAlgoTransactionType,
} from 'algosdk';

export default sdk;
