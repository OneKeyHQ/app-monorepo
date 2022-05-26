import { ed25519 } from '@onekeyfe/blockchain-libs/dist/secret/curves';
import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import { COINTYPE_NEAR as COIN_TYPE } from '../../../constants';
import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import { signTransaction } from './utils';

import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
} from '../../types';

export class KeyringImported extends KeyringImportedBase {
  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { name, privateKey } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }
    const pub = ed25519.publicFromPrivate(privateKey).toString('hex');
    const address = pub; // near address is the public key hexstring itself.
    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${pub}`,
        name: name || '',
        type: AccountType.SIMPLE,
        path: '',
        coinType: COIN_TYPE,
        pub,
        address,
      },
    ]);
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

  override async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const dbAccount = await this.getDbAccount();

    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);
    const signer = signers[dbAccount.address];

    return signTransaction(unsignedTx, signer);
  }

  override signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }
}
