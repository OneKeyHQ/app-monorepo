import { batchGetPublicKeys } from '@onekeyfe/blockchain-libs/dist/secret';
import * as XRPL from 'xrpl';

import { COINTYPE_XRP as COIN_TYPE } from '../../../constants';
import { ExportedSeedCredential } from '../../../dbs/base';
import { OneKeyInternalError } from '../../../errors';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';
import { IPrepareSoftwareAccountsParams } from '../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
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

      const pub = pubkey.toString('hex');

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
}
