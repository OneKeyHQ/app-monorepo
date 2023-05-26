import { NotImplemented } from '../../../errors';
import { VaultHelperBase } from '../../VaultHelperBase';

import { deserializeTransaction } from './utils';

import type { IEncodedTx, INativeTx, IRawTx } from '../../types';
import type { IEncodedTxNear, INativeTxNear } from './types';

export default class VaultHelper extends VaultHelperBase {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseToNativeTx(encodedTx: IEncodedTxNear): Promise<INativeTxNear | null> {
    if (!encodedTx) {
      return Promise.resolve(null);
    }
    return Promise.resolve(deserializeTransaction(encodedTx));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseToEncodedTx(
    rawTxOrEncodedTx: IRawTx | IEncodedTx,
  ): Promise<IEncodedTx | null> {
    return Promise.resolve(rawTxOrEncodedTx);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nativeTxToJson(nativeTx: INativeTx): Promise<string> {
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  jsonToNativeTx(json: string): Promise<INativeTx> {
    throw new NotImplemented();
  }
}
