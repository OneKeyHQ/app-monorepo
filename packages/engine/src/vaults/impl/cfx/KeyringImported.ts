import { secp256k1 } from '@onekeyfe/blockchain-libs/dist/secret/curves';

import { COINTYPE_CFX as COIN_TYPE } from '../../../constants';
import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBVariantAccount } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';
import { IPrepareImportedAccountsParams } from '../../types';

export class KeyringImported extends KeyringImportedBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const selectedAddress = dbAccount.addresses[this.networkId];

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('CFX signers number should be 1.');
    } else if (addresses[0] !== selectedAddress) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const [privateKey] = Object.values(await this.getPrivateKeys(password));

    return { [selectedAddress]: new Signer(privateKey, password, 'secp256k1') };
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { name, privateKey } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }
    const pub = secp256k1.publicFromPrivate(privateKey).toString('hex');
    // TODO: remove addressFromPub & addressToBase from proxy.ts
    const addressOnNetwork = await this.engine.providerManager.addressFromPub(
      this.networkId,
      pub,
    );
    const baseAddress = await this.engine.providerManager.addressToBase(
      this.networkId,
      addressOnNetwork,
    );
    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${pub}`,
        name: name || '',
        type: AccountType.VARIANT,
        path: '',
        coinType: COIN_TYPE,
        pub,
        address: baseAddress,
        addresses: { [this.networkId]: addressOnNetwork },
      },
    ]);
  }
}
