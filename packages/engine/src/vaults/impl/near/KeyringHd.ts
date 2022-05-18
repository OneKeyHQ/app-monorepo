import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { baseDecode, nearApiJs, serializeTransaction } from './utils';

import type { ISignCredentialOptions } from '../../../types/vault';

export class KeyringHd extends KeyringHdBase {
  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const transaction = unsignedTx.payload
      .nativeTx as nearApiJs.transactions.Transaction;

    const signer = await this.getSigner(options);

    const txHash: string = serializeTransaction(transaction, {
      encoding: 'sha256_bs58',
    });
    const res = await signer.sign(baseDecode(txHash));
    const signature = new Uint8Array(res[0]);

    const signedTx = new nearApiJs.transactions.SignedTransaction({
      transaction,
      signature: new nearApiJs.transactions.Signature({
        keyType: transaction.publicKey.keyType,
        data: signature,
      }),
    });
    const rawTx = serializeTransaction(signedTx);

    debugLogger.engine('NEAR signTransaction', {
      unsignedTx,
      signedTx,
      signer,
      txHash,
    });

    return {
      txid: txHash,
      rawTx,
    };
  }

  signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }
}
