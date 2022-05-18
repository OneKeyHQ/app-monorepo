/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { Provider } from '@onekeyfe/blockchain-libs/dist/provider/chains/btc/provider';

import { COINTYPE_BTC as COIN_TYPE } from '../../../constants';
import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { IPrepareImportedAccountsParams } from '../../../types/vault';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

export class KeyringImported extends KeyringImportedBase {
  override async getSigners(
    password: string,
    addresses: Array<string>,
  ): Promise<Record<string, Signer>> {
    throw new NotImplemented();
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBUTXOAccount>> {
    const { privateKey, name } = params;
    const provider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as Provider;
    let xpub = '';

    try {
      xpub = provider.xprvToXpub(privateKey.toString('hex'));
    } catch (e) {
      console.error(e);
      throw new OneKeyInternalError('Invalid private key.');
    }

    const firstAddressRelPath = '0/0';
    const { [firstAddressRelPath]: address } = provider.xpubToAddresses(xpub, [
      firstAddressRelPath,
    ]);

    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${xpub}`,
        name: name || '',
        type: AccountType.UTXO,
        path: '',
        coinType: COIN_TYPE,
        xpub,
        address,
        addresses: { [firstAddressRelPath]: address },
      },
    ]);
  }
}
