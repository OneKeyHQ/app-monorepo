import bs58check from 'bs58check';

import type { ExtendedKey } from '@onekeyhq/engine/src/secret';
import { BaseBip32KeyDeriver } from '@onekeyhq/engine/src/secret/bip32';
import type { Bip32KeyDeriver } from '@onekeyhq/engine/src/secret/bip32';
import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import {
  decrypt,
  encrypt,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import type { DBUTXOAccount } from '../../../types/account';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type BTCForkVault from './VaultBtcFork';

const deriver = new BaseBip32KeyDeriver(
  Buffer.from('Bitcoin seed'),
  secp256k1,
) as Bip32KeyDeriver;

export class KeyringImported extends KeyringImportedBase {
  override async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const { password } = options;
    if (typeof password === 'undefined') {
      throw new OneKeyInternalError('Software signing requires a password.');
    }
    const signers = await this.getSigners(
      password,
      unsignedTx.inputs.map((input) => input.address),
    );
    debugLogger.engine.info('signTransaction', this.networkId, unsignedTx);

    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();
    return provider.signTransaction(unsignedTx, signers);
  }

  override async getSigners(
    password: string,
    addresses: string[],
  ): Promise<Record<string, Signer>> {
    const relPathToAddress: Record<string, string> = {};
    const utxos = await (this.vault as unknown as BTCForkVault).collectUTXOs();
    for (const utxo of utxos) {
      const { address, path } = utxo;
      if (addresses.includes(address)) {
        const relPath = path.split('/').slice(-2).join('/');
        relPathToAddress[relPath] = address;
      }
    }

    const relPaths = Object.keys(relPathToAddress);
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

      const address = relPathToAddress[relPath];
      ret[address] = new Signer(
        encrypt(password, cache[relPath].key),
        password,
        'secp256k1',
      );
    });

    return ret;
  }

  async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const { privateKey, name } = params;
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();
    const COIN_TYPE = (this.vault as unknown as BTCForkVault).getCoinType();

    let xpub = '';

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
