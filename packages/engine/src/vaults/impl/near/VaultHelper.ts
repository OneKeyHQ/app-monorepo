import { NotImplemented } from '../../../errors';
import { VaultHelperBase } from '../../VaultHelperBase';

import { deserializeTransaction, nearApiJs } from './utils';

import type { IEncodedTx } from '../../types';

export default class VaultHelper extends VaultHelperBase {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseToNativeTx(
    _encodedTx: IEncodedTx,
  ): Promise<nearApiJs.transactions.Transaction> {
    return Promise.resolve(deserializeTransaction(_encodedTx));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseToEncodedTx(rawTxOrEncodedTx: any): Promise<any> {
    return Promise.resolve(rawTxOrEncodedTx);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nativeTxToJson(nativeTx: any): Promise<string> {
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  jsonToNativeTx(json: string): Promise<any> {
    throw new NotImplemented();
  }
}
