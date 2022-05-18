import { batchGetPublicKeys } from '@onekeyfe/blockchain-libs/dist/secret';
import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { COINTYPE_NEAR as COIN_TYPE } from '../../../constants';
import { ExportedSeedCredential } from '../../../dbs/base';
import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { IPrepareSoftwareAccountsParams } from '../../../types/vault';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { baseDecode, nearApiJs, serializeTransaction } from './utils';

import type { ISignCredentialOptions } from '../../../types/vault';

// m/44'/397'/0'
const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'`;

export class KeyringHd extends KeyringHdBase {
  // async getSigner(options: ISignCredentialOptions) {
  //   const { networkId } = this;
  //   const dbAccount = await this.getDbAccount();
  //   const credential = await this.getCredential(options);
  //   const signers = this.engine.providerManager.getSigners(
  //     networkId,
  //     credential,
  //     dbAccount,
  //   );
  //   const signer = signers[dbAccount.address];
  //   return signer;
  // }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { password, indexes, names } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const pubkeyInfos = batchGetPublicKeys(
      'ed25519',
      seed,
      password,
      PATH_PREFIX,
      indexes.map((index) => index.toString()),
    );

    if (pubkeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    let index = 0;
    for (const info of pubkeyInfos) {
      const {
        path,
        extendedKey: { key: pubkey },
      } = info;
      const pub = pubkey.toString('hex');
      const address = await this.engine.providerManager.addressFromPub(
        this.networkId,
        pub,
      );
      const name = (names || [])[index] || `ETH #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub,
        address,
      });
      index += 1;
    }
    return ret;
  }

  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('NEAR signers number should be 1.');
    } else if (addresses[0] !== dbAccount.address) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const { [dbAccount.path]: privateKey } = await this.getPrivateKeys(
      password,
    );
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get signer.');
    }

    return {
      [dbAccount.address]: new Signer(privateKey, password, 'ed25519'),
    };
  }

  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const dbAccount = await this.getDbAccount();

    const transaction = unsignedTx.payload
      .nativeTx as nearApiJs.transactions.Transaction;

    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);
    const signer = signers[dbAccount.address];

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
