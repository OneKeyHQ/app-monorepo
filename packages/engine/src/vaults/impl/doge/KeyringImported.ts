import { secp256k1 } from '@onekeyfe/blockchain-libs/dist/secret/curves';
import bs58check from 'bs58check';

import { COINTYPE_DOGE as COIN_TYPE } from '../../../constants';
import { OneKeyInternalError } from '../../../errors';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';
import { IPrepareImportedAccountsParams } from '../../types';

import { Provider } from './btcForkChainUtils/provider';

// @ts-ignore
export class KeyringImported extends KeyringImportedBase {
  async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const { privateKey, name } = params;
    const provider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as unknown as Provider;
    let xpub = '';

    const { network } = provider;
    const xprvVersionBytesNum = parseInt(
      privateKey.slice(0, 4).toString('hex'),
      16,
    );
    for (const versionBytes of [network.bip32]) {
      if (versionBytes.private === xprvVersionBytesNum) {
        const publicKey = secp256k1.publicFromPrivate(privateKey.slice(46, 78));
        const pubVersionBytes = Buffer.from(
          versionBytes.public.toString(16).padStart(8, '0'),
          'hex',
        );
        try {
          xpub = bs58check.encode(
            privateKey.fill(pubVersionBytes, 0, 4).fill(publicKey, 45, 78),
          );
        } catch (e) {
          console.error(e);
        }
      }
    }
    if (xpub === '') {
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
