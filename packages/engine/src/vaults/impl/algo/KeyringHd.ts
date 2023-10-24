import { isArray } from 'lodash';

import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import type { CurveName } from '@onekeyhq/engine/src/secret';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_ALGO as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import sdk from './sdkAlgo';
import { signTransaction } from './utils';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBSimpleAccount } from '../../../types/account';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type { IEncodedTxAlgo, IEncodedTxGroupAlgo } from './types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0'`;

export class KeyringHd extends KeyringHdBase {
  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const curve: CurveName = 'ed25519';
    const accountNamePrefix = 'ALGO';
    const hardened = true;

    const { password, indexes, names } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const pubkeyInfos = batchGetPublicKeys(
      curve,
      seed,
      password,
      PATH_PREFIX,
      indexes.map((index) => `${index}${hardened ? "'" : ''}`),
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
      const address = sdk.encodeAddress(pubkey);
      const name =
        (names || [])[index] || `${accountNamePrefix} #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub: `${pubkey.toString('hex')}`,
        address,
      });
      index += 1;
    }
    return ret;
  }

  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('ALGO signers number should be 1.');
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
    const { encodedTx } = unsignedTx.payload as {
      encodedTx: IEncodedTxAlgo | IEncodedTxGroupAlgo;
    };

    if (isArray(encodedTx)) {
      const signedTxs = await Promise.all(
        encodedTx.map((tx) => signTransaction(tx, signer)),
      );

      return {
        txid: signedTxs.map((tx) => tx.txid).join(','),
        rawTx: signedTxs.map((tx) => tx.rawTx).join(','),
      };
    }

    return signTransaction(encodedTx, signer);
  }

  override signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }
}
