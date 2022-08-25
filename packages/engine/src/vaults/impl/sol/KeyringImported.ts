/* eslint-disable @typescript-eslint/no-unused-vars */
import { ed25519 } from '@onekeyfe/blockchain-libs/dist/secret/curves';
import { PublicKey } from '@solana/web3.js';

import { COINTYPE_SOL as COIN_TYPE } from '../../../constants';
import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

export class KeyringImported extends KeyringImportedBase {
  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { name, privateKey } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }
    const address = new PublicKey(
      ed25519.publicFromPrivate(privateKey),
    ).toBase58();
    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${address}`,
        name: name || '',
        type: AccountType.SIMPLE,
        path: '',
        coinType: COIN_TYPE,
        pub: address, // base58 encoded
        address,
      },
    ]);
  }

  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('SOL signers number should be 1.');
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

  override signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    // TODO
    throw new NotImplemented();
  }

  override signMessage(messages: any[], options: ISignCredentialOptions): any {
    throw new NotImplemented();
  }
}
