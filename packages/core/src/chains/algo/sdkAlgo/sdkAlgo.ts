import * as sdk from 'algosdk';
import {
  Transaction,
  decodeObj,
  encodeAddress,
  encodeObj,
  mnemonicFromSeed,
} from 'algosdk';

export type {
  EncodedTransaction as ISdkAlgoEncodedTransaction,
  Transaction as ISdkAlgoTransaction,
  TransactionType as ISdkAlgoTransactionType,
} from 'algosdk';

type IAlgoSdk = typeof import('algosdk');

const sdkNamespace = sdk as IAlgoSdk & {
  default?: IAlgoSdk & {
    default?: IAlgoSdk;
  };
};

const sdkAlgo = {
  ...sdkNamespace.default?.default,
  ...sdkNamespace.default,
  ...sdkNamespace,
  Transaction,
  decodeObj,
  encodeAddress,
  encodeObj,
  mnemonicFromSeed,
};

export default sdkAlgo as IAlgoSdk;
