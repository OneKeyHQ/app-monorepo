import { Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import { NotImplemented } from '../../../errors';
import { VaultHelperBase } from '../../VaultHelperBase';

import type { IEncodedTx, IRawTx } from '../../types';
import type { IEncodedTxSol, INativeTxSol } from './types';

export default class VaultHelper extends VaultHelperBase {
  parseToNativeTx(encodedTx: IEncodedTxSol): Promise<INativeTxSol | null> {
    if (!encodedTx) {
      return Promise.resolve(null);
    }

    const txByte = bs58.decode(encodedTx);

    try {
      return Promise.resolve(Transaction.from(txByte));
    } catch (e) {
      return Promise.resolve(VersionedTransaction.deserialize(txByte));
    }
  }

  parseToEncodedTx(
    rawTxOrEncodedTx: IRawTx | IEncodedTx,
  ): Promise<IEncodedTx | null> {
    return Promise.resolve(rawTxOrEncodedTx);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nativeTxToJson(nativeTx: INativeTxSol): Promise<string> {
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  jsonToNativeTx(json: string): Promise<INativeTxSol> {
    throw new NotImplemented();
  }
}
