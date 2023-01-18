/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import bs58check from 'bs58check';

import type { Provider } from '@onekeyhq/blockchain-libs/src/provider/chains/btc/provider';
import type { ExtendedKey } from '@onekeyhq/engine/src/secret';
import { BaseBip32KeyDeriver } from '@onekeyhq/engine/src/secret/bip32';
import type { Bip32KeyDeriver } from '@onekeyhq/engine/src/secret/bip32';
import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import {
  decrypt,
  encrypt,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { COINTYPE_BTC as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import type { DBUTXOAccount } from '../../../types/account';
import type { IPrepareImportedAccountsParams } from '../../types';
import type BTCVault from './Vault';

const deriver = new BaseBip32KeyDeriver(
  Buffer.from('Bitcoin seed'),
  secp256k1,
) as Bip32KeyDeriver;

export class KeyringImported extends KeyringImportedBase {
  override async getSigners(
    password: string,
    addresses: Array<string>,
  ): Promise<Record<string, Signer>> {
    const relPathToAddresses: Record<string, string> = {};
    const utxos = await (this.vault as BTCVault).collectUTXOs();
    for (const utxo of utxos) {
      const { address, path } = utxo;
      if (addresses.includes(address)) {
        const relPath = path.split('/').slice(-2).join('/');
        relPathToAddresses[relPath] = address;
      }
    }

    const relPaths = Object.keys(relPathToAddresses);
    if (relPaths.length === 0) {
      throw new OneKeyInternalError('No signers would be chosen.');
    }

    const ret: Record<string, Signer> = {};
    const cache: Record<string, ExtendedKey> = {};

    const [encryptedXprv] = Object.values(await this.getPrivateKeys(password));
    const xprv = decrypt(password, encryptedXprv);
    const startKey = { chainCode: xprv.slice(13, 45), key: xprv.slice(46, 78) };

    relPaths.forEach((relPath) => {
      const pathComponents = relPath.split('/');

      let currentPath = '';
      let parent = startKey;
      pathComponents.forEach((pathComponent) => {
        currentPath =
          currentPath.length > 0
            ? `${currentPath}/${pathComponent}`
            : pathComponent;
        if (typeof cache[currentPath] === 'undefined') {
          const index = pathComponent.endsWith("'")
            ? parseInt(pathComponent.slice(0, -1)) + 2 ** 31
            : parseInt(pathComponent);
          const thisPrivKey = deriver.CKDPriv(parent, index);
          cache[currentPath] = thisPrivKey;
        }
        parent = cache[currentPath];
      });
      const address = relPathToAddresses[relPath];
      ret[address] = new Signer(
        encrypt(password, cache[relPath].key),
        password,
        'secp256k1',
      );
    });
    return ret;
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
