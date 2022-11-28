import { COINTYPE_ADA as COIN_TYPE } from '../../../constants';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';
import { IPrepareImportedAccountsParams } from '../../types';

import { encodePrivateKey } from './helper/bip32';
import { batchGetShelleyAddressByRootKey } from './helper/shelley-address';
import { NetworkId } from './types';

// @ts-ignore
export class KeyringImported extends KeyringImportedBase {
  override prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const { privateKey, name } = params;
    console.log(privateKey);

    const encodeKey = encodePrivateKey(privateKey);
    console.log(encodeKey);

    const index = parseInt(encodeKey.index);
    const addressInfos = batchGetShelleyAddressByRootKey(
      encodeKey.rootKey,
      [index],
      NetworkId.MAINNET,
    );

    const { baseAddress, stakingAddress } = addressInfos[0];
    const { address, path, xpub } = baseAddress;

    const firstAddressRelPath = '0/0';
    const stakingAddressPath = '2/0';
    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${xpub}`,
        name: name || '',
        type: AccountType.UTXO,
        path,
        coinType: COIN_TYPE,
        xpub,
        address,
        addresses: {
          [firstAddressRelPath]: address,
          [stakingAddressPath]: stakingAddress.address,
        },
      },
    ]);
  }
}
