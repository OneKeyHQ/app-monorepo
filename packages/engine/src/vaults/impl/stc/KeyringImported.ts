/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import { ed25519 } from '@onekeyhq/engine/src/secret/curves';
import { COINTYPE_STC as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import type { DBSimpleAccount } from '../../../types/account';
import type { IPrepareImportedAccountsParams } from '../../types';

export class KeyringImported extends KeyringImportedBase {
  override async getSigners(
    password: string,
    addresses: Array<string>,
  ): Promise<Record<string, Signer>> {
    const dbAccount = await this.getDbAccount();
    if (addresses.length !== 1) {
      throw new OneKeyInternalError('Starcoin signers number should be 1.');
    } else if (addresses[0] !== dbAccount.address) {
      throw new OneKeyInternalError('Wrong address required for signing');
    }

    const [privateKey] = Object.values(await this.getPrivateKeys(password));
    return {
      [dbAccount.address]: new Signer(privateKey, password, 'ed25519'),
    };
  }

  async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { privateKey, name } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }

    const pubBuffer = ed25519.publicFromPrivate(privateKey);
    const pub = pubBuffer.toString('hex');
    const address = await this.engine.providerManager.pubkeyToAddress(
      this.networkId,
      {
        getPubkey: (_compressed?: boolean) => Promise.resolve(pubBuffer),
        verify: (_digest, _signature) => Promise.resolve(Buffer.from([])),
      },
      'hex',
    );

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
}
