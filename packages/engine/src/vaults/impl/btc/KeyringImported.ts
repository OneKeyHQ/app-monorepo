/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { Provider } from '@onekeyfe/blockchain-libs/dist/provider/chains/btc/provider';
import { secp256k1 } from '@onekeyfe/blockchain-libs/dist/secret/curves';
import bs58check from 'bs58check';

import { COINTYPE_BTC as COIN_TYPE } from '../../../constants';
import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';
import { IPrepareImportedAccountsParams } from '../../types';

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

    /* TODO: error in blockchain-libs, need to fix it.
    try {
      xpub = provider.xprvToXpub(bs58check.encode(privateKey));
    } catch (e) {
      console.error(e);
      throw new OneKeyInternalError('Invalid private key.');
    }
    */
    const { network } = provider;
    const xprvVersionBytesNum = parseInt(
      privateKey.slice(0, 4).toString('hex'),
      16,
    );
    for (const versionBytes of [
      ...Object.values(network.segwitVersionBytes || {}),
      network.bip32,
    ]) {
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
