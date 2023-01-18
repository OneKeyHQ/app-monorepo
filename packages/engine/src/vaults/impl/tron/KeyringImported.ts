import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_TRON as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import { publicKeyToAddress, signTransaction } from './utils';

import type { DBSimpleAccount } from '../../../types/account';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
} from '../../types';

export class KeyringImported extends KeyringImportedBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('TRON signers number should be 1.');
    } else if (addresses[0] !== dbAccount.address) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const [privateKey] = Object.values(await this.getPrivateKeys(password));

    return {
      [dbAccount.address]: new Signer(privateKey, password, 'secp256k1'),
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

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { name, privateKey } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }
    const pub = secp256k1.publicFromPrivate(privateKey).toString('hex');
    const address = publicKeyToAddress(pub);
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
