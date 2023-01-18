import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_TRON as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { publicKeyToAddress, signTransaction } from './utils';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBSimpleAccount } from '../../../types/account';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;

export class KeyringHd extends KeyringHdBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('TRON signers number should be 1.');
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
      [dbAccount.address]: new Signer(privateKey, password, 'secp256k1'),
    };
  }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { password, indexes, names } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const pubkeyInfos = batchGetPublicKeys(
      'secp256k1',
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
      const address = publicKeyToAddress(pub);
      const name = (names || [])[index] || `TRON #${indexes[index] + 1}`;
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
}
