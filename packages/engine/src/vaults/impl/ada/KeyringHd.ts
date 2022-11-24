import { COINTYPE_ADA as COIN_TYPE } from '../../../constants';
import { ExportedSeedCredential } from '../../../dbs/base';
import { OneKeyInternalError } from '../../../errors';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';
import { IPrepareSoftwareAccountsParams } from '../../types';

import { batchGetShelleyAddresses } from './helper/shelley-address';
import { NetworkId } from './types';

// const PATH_PREFIX = `m/1852'/${COIN_TYPE}'`;

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const { password, indexes, names } = params;
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const addressInfos = await batchGetShelleyAddresses(
      entropy,
      password,
      indexes,
      NetworkId.MAINNET,
    );

    if (addressInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get address');
    }

    const firstAddressRelPath = '0/0';
    const ret = addressInfos.map((info, index) => {
      const { address, path, xpub } = info;
      const name = (names || [])[index] || `ADA #${indexes[index] + 1}`;
      return {
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.UTXO,
        path,
        coinType: COIN_TYPE,
        xpub,
        address,
        addresses: { [firstAddressRelPath]: address },
      };
    });

    return ret;
  }
}
