import { batchGetPublicKeys } from '@onekeyfe/blockchain-libs/dist/secret';

import { COINTYPE_CFX as COIN_TYPE } from '../../../constants';
import { ExportedSeedCredential } from '../../../dbs/base';
import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBVariantAccount } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';
import { IPrepareSoftwareAccountsParams } from '../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;

export class KeyringHd extends KeyringHdBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const selectedAddress = dbAccount.addresses[this.networkId];

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('CFX signers number should be 1.');
    } else if (addresses[0] !== selectedAddress) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const { [dbAccount.path]: privateKey } = await this.getPrivateKeys(
      password,
    );
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get signer.');
    }

    return { [selectedAddress]: new Signer(privateKey, password, 'secp256k1') };
  }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
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
      const addressOnNetwork = await this.engine.providerManager.addressFromPub(
        this.networkId,
        pub,
      );
      const baseAddress = await this.engine.providerManager.addressToBase(
        this.networkId,
        addressOnNetwork,
      );
      const name = (names || [])[index] || `CFX #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.VARIANT,
        path,
        coinType: COIN_TYPE,
        pub,
        address: baseAddress,
        addresses: { [this.networkId]: addressOnNetwork },
      });
      index += 1;
    }
    return ret;
  }
}
