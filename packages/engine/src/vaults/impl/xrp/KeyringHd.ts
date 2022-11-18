import { batchGetPublicKeys } from '@onekeyfe/blockchain-libs/dist/secret';
import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import * as XRPL from 'xrpl';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { COINTYPE_XRP as COIN_TYPE } from '../../../constants';
import { ExportedSeedCredential } from '../../../dbs/base';
import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';
import {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';

import { signature } from './utils';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;

export class KeyringHd extends KeyringHdBase {
  override async getSigners(
    password: string,
    addresses: string[],
  ): Promise<Record<string, Signer>> {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('Starcoin signers number should be 1.');
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
  ): Promise<DBSimpleAccount[]> {
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
      indexes.map((index) => `${index.toString()}'/0/0`),
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

      const pub = pubkey.toString('hex').toUpperCase();

      const address = XRPL.deriveAddress(pub);

      const name = (names || [])[index] || `XRP #${indexes[index] + 1}`;
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
    debugLogger.sendTx.info('signTransaction result', unsignedTx);

    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);
    const signer = signers[dbAccount.address];
    const prvKey = (await signer.getPrvkey()).toString('hex').toUpperCase();
    const sign = signature(
      unsignedTx.payload.encodedTx,
      dbAccount.pub,
      `00${prvKey}`,
    );

    return {
      txid: sign.hash,
      rawTx: sign.tx_blob,
    };
  }
}
