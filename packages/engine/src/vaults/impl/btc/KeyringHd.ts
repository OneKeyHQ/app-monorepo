/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { Provider } from '@onekeyfe/blockchain-libs/dist/provider/chains/btc/provider';
import { batchGetPublicKeys } from '@onekeyfe/blockchain-libs/dist/secret';
import bs58check from 'bs58check';

import { COINTYPE_BTC as COIN_TYPE } from '../../../constants';
import { ExportedSeedCredential } from '../../../dbs/base';
import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';
import { IPrepareSoftwareAccountsParams } from '../../types';

import { getAccountDefaultByPurpose } from './utils';

import type BTCVault from './Vault';

const DEFAULT_PURPOSE = 49;

export class KeyringHd extends KeyringHdBase {
  override async getSigners(
    password: string,
    addresses: Array<string>,
  ): Promise<Record<string, Signer>> {
    const relPathToAddresses: Record<string, string> = {};
    const utxos = await (this.vault as BTCVault).collectUTXOs();
    for (const utxo of utxos) {
      const { address, path } = utxo;
      if (addresses.includes(address)) {
        relPathToAddresses[path] = address;
      }
    }

    const relPaths = Object.keys(relPathToAddresses).map((fullPath) =>
      fullPath.split('/').slice(-2).join('/'),
    );
    if (relPaths.length === 0) {
      throw new OneKeyInternalError('No signers would be chosen.');
    }
    const privateKeys = await this.getPrivateKeys(password, relPaths);
    const ret: Record<string, Signer> = {};
    for (const [path, privateKey] of Object.entries(privateKeys)) {
      const address = relPathToAddresses[path];
      ret[address] = new Signer(privateKey, password, 'secp256k1');
    }
    return ret;
  }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBUTXOAccount>> {
    const { password, indexes, purpose, names } = params;
    const usedPurpose = purpose || DEFAULT_PURPOSE;
    const ignoreFirst = indexes[0] !== 0;
    const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];
    const { namePrefix, addressEncoding } =
      getAccountDefaultByPurpose(usedPurpose);
    const provider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as Provider;
    const { network } = provider;
    const { public: xpubVersionBytes } =
      (network.segwitVersionBytes || {})[addressEncoding] || network.bip32;

    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    const pubkeyInfos = batchGetPublicKeys(
      'secp256k1',
      seed,
      password,
      `m/${usedPurpose}'/${COIN_TYPE}'`,
      usedIndexes.map((index) => `${index.toString()}'`),
    );
    if (pubkeyInfos.length !== usedIndexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    let index = 0;
    for (const { path, parentFingerPrint, extendedKey } of pubkeyInfos) {
      const xpub = bs58check.encode(
        Buffer.concat([
          Buffer.from(xpubVersionBytes.toString(16).padStart(8, '0'), 'hex'),
          Buffer.from([3]),
          parentFingerPrint,
          Buffer.from(
            (usedIndexes[index] + 2 ** 31).toString(16).padStart(8, '0'),
            'hex',
          ),
          extendedKey.chainCode,
          extendedKey.key,
        ]),
      );
      const firstAddressRelPath = '0/0';
      const { [firstAddressRelPath]: address } = provider.xpubToAddresses(
        xpub,
        [firstAddressRelPath],
      );
      const name =
        (names || [])[index] || `${namePrefix} #${usedIndexes[index] + 1}`;
      if (!ignoreFirst || index > 0) {
        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.UTXO,
          path,
          coinType: COIN_TYPE,
          xpub,
          address,
          addresses: { [firstAddressRelPath]: address },
        });
      }

      if (usedIndexes.length === 1) {
        // Only getting the first account, ignore balance checking.
        break;
      }

      const { txs } = (await provider.getAccount(
        { type: 'simple', xpub },
        addressEncoding,
      )) as { txs: number };
      if (txs > 0) {
        index += 1;
        // TODO: blockbook API rate limit.
        await new Promise((r) => setTimeout(r, 200));
      } else {
        break;
      }
    }
    return ret;
  }
}
