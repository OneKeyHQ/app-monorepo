import bs58check from 'bs58check';

import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import {
  COINTYPE_BCH,
  COINTYPE_DOGE,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyInternalError } from '../../../errors';
import { slicePathTemplate } from '../../../managers/derivation';
import { getAccountNameInfoByTemplate } from '../../../managers/impl';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { getAccountDefaultByPurpose } from './utils';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBUTXOAccount } from '../../../types/account';
import type {
  IPrepareAccountByAddressIndexParams,
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type { AddressEncodings } from './types';
import type BTCForkVault from './VaultBtcFork';

export class KeyringHd extends KeyringHdBase {
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
    addresses: Array<string>,
  ): Promise<Record<string, Signer>> {
    const relPathToAddresses: Record<string, string> = {};
    const utxos = await (this.vault as unknown as BTCForkVault).collectUTXOs();
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
  ): Promise<DBUTXOAccount[]> {
    const {
      password,
      indexes,
      purpose,
      names,
      template,
      skipCheckAccountExist,
    } = params;
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();

    const ret = await this.createAccount({
      password,
      indexes,
      purpose,
      names,
      template,
      addressIndex: 0,
      isChange: false,
      isCustomAddress: false,
      validator: skipCheckAccountExist
        ? undefined
        : async ({ xpub, addressEncoding }) => {
            const { txs } = (await provider.getAccount(
              { type: 'simple', xpub },
              addressEncoding,
            )) as { txs: number };
            return txs > 0;
          },
    });
    return ret;
  }

  private async createAccount({
    password,
    indexes,
    purpose,
    names,
    template,
    addressIndex,
    isChange,
    isCustomAddress,
    validator,
  }: {
    password: string;
    indexes: number[];
    purpose?: number;
    names?: string[];
    template: string;
    addressIndex: number;
    isChange: boolean;
    isCustomAddress: boolean;
    validator?: ({
      xpub,
      address,
      addressEncoding,
    }: {
      xpub: string;
      address: string;
      addressEncoding: AddressEncodings;
    }) => Promise<boolean>;
  }) {
    const impl = await this.getNetworkImpl();
    const vault = this.vault as unknown as BTCForkVault;
    const defaultPurpose = vault.getDefaultPurpose();
    const coinName = vault.getCoinName();
    const COIN_TYPE = vault.getCoinType();

    const usedPurpose = purpose || defaultPurpose;
    const ignoreFirst = indexes[0] !== 0;
    const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];
    const { addressEncoding } = getAccountDefaultByPurpose(
      usedPurpose,
      coinName,
    );
    const { prefix: namePrefix } = getAccountNameInfoByTemplate(impl, template);
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();
    const { network } = provider;
    const { pathPrefix } = slicePathTemplate(template);
    const pubkeyInfos = batchGetPublicKeys(
      'secp256k1',
      seed,
      password,
      pathPrefix,
      usedIndexes.map((index) => `${index.toString()}'`),
    );
    if (pubkeyInfos.length !== usedIndexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const { public: xpubVersionBytes } =
      (network.segwitVersionBytes || {})[addressEncoding] || network.bip32;

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
      const addressRelPath = `${isChange ? '1' : '0'}/${addressIndex}`;
      const { [addressRelPath]: address } = provider.xpubToAddresses(
        xpub,
        [addressRelPath],
        addressEncoding,
      );
      const customAddresses = isCustomAddress
        ? { [addressRelPath]: address }
        : undefined;
      const prefix = [COINTYPE_DOGE, COINTYPE_BCH].includes(COIN_TYPE)
        ? coinName
        : namePrefix;
      const name =
        (names || [])[index] || `${prefix} #${usedIndexes[index] + 1}`;
      if (!ignoreFirst || index > 0) {
        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.UTXO,
          path,
          coinType: COIN_TYPE,
          xpub,
          address,
          addresses: { [addressRelPath]: address },
          customAddresses,
          template,
        });
      }

      if (usedIndexes.length === 1) {
        // Only getting the first account, ignore balance checking.
        break;
      }

      if (validator) {
        if (await validator?.({ xpub, address, addressEncoding })) {
          index += 1;
          await new Promise((r) => setTimeout(r, 200));
        } else {
          // Software should prevent a creation of an account
          // if a previous account does not have a transaction history (meaning none of its addresses have been used before).
          // https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
          break;
        }
      } else {
        index += 1;
      }
    }
    return ret;
  }

  override async prepareAccountByAddressIndex(
    params: IPrepareAccountByAddressIndexParams,
  ): Promise<DBUTXOAccount[]> {
    const { password, template, accountIndex, addressIndex } = params;
    const purpose = parseInt(template.split('/')?.[1], 10);
    const ret = await this.createAccount({
      password,
      indexes: [accountIndex],
      purpose,
      template,
      addressIndex,
      isChange: false,
      isCustomAddress: true,
    });
    return ret;
  }
}
