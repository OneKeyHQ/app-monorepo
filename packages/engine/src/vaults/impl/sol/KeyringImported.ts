import { PublicKey } from '@solana/web3.js';

import { ed25519 } from '@onekeyhq/engine/src/secret/curves';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_SOL as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import { signMessage, signTransaction } from './utils';

import type { DBSimpleAccount } from '../../../types/account';
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

  override async signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    const dbAccount = await this.getDbAccount();
    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);
    const signer = signers[dbAccount.address];

    return Promise.all(
      messages.map(({ message }) => signMessage(message, signer)),
    );
  }
}
