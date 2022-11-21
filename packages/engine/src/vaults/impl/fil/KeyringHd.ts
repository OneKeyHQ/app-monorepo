import { CoinType, newSecp256k1Address } from '@glif/filecoin-address';
import {
  CurveName,
  batchGetPublicKeys,
} from '@onekeyfe/blockchain-libs/dist/secret';

import { COINTYPE_FIL as COIN_TYPE } from '../../../constants';
import { ExportedSeedCredential } from '../../../dbs/base';
import { OneKeyInternalError } from '../../../errors';
import { AccountType, DBVariantAccount } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';
import {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const curve: CurveName = 'secp256k1';
    const accountNamePrefix = 'FIL';
    const { password, indexes, names } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    const network = await this.getNetwork();

    const pubkeyInfos = batchGetPublicKeys(
      curve,
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
      const address = newSecp256k1Address(
        pubkey,
        network.isTestnet ? CoinType.TEST : CoinType.MAIN,
      ).toString();
      const name =
        (names || [])[index] || `${accountNamePrefix} #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.VARIANT,
        path,
        coinType: COIN_TYPE,
        pub,
        address,
        addresses: { [this.networkId]: address },
      });
      index += 1;
    }
    return ret;
  }
}
