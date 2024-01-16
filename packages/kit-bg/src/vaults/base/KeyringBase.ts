// eslint-disable-next-line max-classes-per-file
import { isNil } from 'lodash';

import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { wait } from '@onekeyhq/kit/src/utils/helper';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { EDBAccountType } from '../../dbs/local/consts';
import { EVaultKeyringTypes } from '../types';

import { VaultContext } from './VaultContext';

import type { VaultBase } from './VaultBase';
import type {
  IDBAccount,
  IDBSimpleAccount,
  IDBUtxoAccount,
  IDBVariantAccount,
} from '../../dbs/local/types';
import type {
  IPrepareAccountsParams,
  IPrepareHdAccountsOptions,
  IPrepareHdAccountsParamsBase,
  ISignMessageParams,
  ISignTransactionParams,
} from '../types';

export abstract class KeyringBase extends VaultContext {
  constructor(vault: VaultBase) {
    super(vault.options);
    this.vault = vault;
  }

  vault: VaultBase;

  abstract coreApi: CoreChainApiBase | undefined;

  abstract keyringType: EVaultKeyringTypes;

  isKeyringImported() {
    return this.keyringType === EVaultKeyringTypes.imported;
  }

  isKeyringHd() {
    return this.keyringType === EVaultKeyringTypes.hd;
  }

  isKeyringHardware() {
    return this.keyringType === EVaultKeyringTypes.hardware;
  }

  isKeyringWatching() {
    return this.keyringType === EVaultKeyringTypes.watching;
  }

  async basePrepareHdNormalAccounts(
    params: IPrepareHdAccountsParamsBase,
    options: IPrepareHdAccountsOptions,
  ): Promise<Array<IDBSimpleAccount | IDBVariantAccount>> {
    const { names, deriveInfo, indexes } = params;
    const { coinType, template, namePrefix, idSuffix } = deriveInfo;
    if (!coinType) {
      throw new Error('coinType is not defined');
    }
    if (!this.walletId) {
      throw new Error('walletId is not defined');
    }
    const settings = await this.getVaultSettings();
    const { accountType } = settings;

    const { buildAddressesInfo } = options;

    const usedIndexes = indexes;
    const addressInfos = await buildAddressesInfo({
      usedIndexes,
    });

    const ret: Array<IDBSimpleAccount | IDBVariantAccount> = [];
    for (let index = 0; index < addressInfos.length; index += 1) {
      const { path, publicKey, address, addresses } = addressInfos[index];
      if (!path) {
        throw new Error('KeyringHD prepareAccounts ERROR: path not found');
      }
      if (accountType === EDBAccountType.VARIANT && !addresses) {
        throw new Error('addresses is required for variant account');
      }

      const name = names?.[index] || `${namePrefix} #${usedIndexes[index] + 1}`;

      const id = accountUtils.buildHDAccountId({
        walletId: this.walletId,
        path,
        idSuffix,
      });

      ret.push({
        id,
        name,
        type: accountType,
        path,
        coinType, // TODO save deriveType to account
        pub: publicKey,
        address,
        addresses,
        template,
      });
    }

    return ret;
  }

  async basePrepareHdUtxoAccounts(
    params: IPrepareHdAccountsParamsBase,
    options: IPrepareHdAccountsOptions,
  ): Promise<IDBUtxoAccount[]> {
    if (!this.walletId) {
      throw new Error('walletId is undefined');
    }
    const {
      indexes,
      deriveInfo,
      // purpose,
      names,
      skipCheckAccountExist,
    } = params;
    const { coinType, template, namePrefix } = deriveInfo;
    if (!coinType) {
      throw new Error('coinType is not defined');
    }
    const { checkIsAccountUsed, buildAddressesInfo } = options;

    const ignoreFirst = indexes[0] !== 0;
    // check first prev non-zero index account existing
    const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];

    const addressesInfo = await buildAddressesInfo({
      usedIndexes,
    });

    const ret: IDBUtxoAccount[] = [];
    let index = 0;
    for (const {
      path,
      publicKey,
      xpub,
      xpubSegwit,
      address,
      addresses,
    } of addressesInfo) {
      if (!path || isNil(xpub) || !addresses) {
        throw new Error('path or xpub or addresses is undefined');
      }

      const prefix = namePrefix;
      const name = names?.[index] || `${prefix} #${usedIndexes[index] + 1}`;
      const id = `${this.walletId}--${path}`;
      if (!ignoreFirst || index > 0) {
        ret.push({
          id,
          name,
          type: EDBAccountType.UTXO,
          path,
          coinType,
          pub: publicKey,
          xpub,
          xpubSegwit,
          address,
          addresses,
          template,
        });
      }

      const isLast = index === addressesInfo.length - 1;
      if (!skipCheckAccountExist && !isLast && checkIsAccountUsed) {
        const { isUsed } = await checkIsAccountUsed({
          xpub,
          xpubSegwit,
          address,
        });
        if (!isUsed) {
          // Software should prevent a creation of an account
          // if a previous account does not have a transaction history (meaning none of its addresses have been used before).
          // https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
          break;
        }
        // blockbook API rate limit.
        await wait(200);
      }

      index += 1;
    }
    return ret;
  }

  abstract signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro>;

  abstract signMessage(params: ISignMessageParams): Promise<ISignedMessagePro>;

  abstract prepareAccounts(
    params: IPrepareAccountsParams,
  ): Promise<IDBAccount[]>;
}

// @ts-ignore
export class KeyringBaseMock extends KeyringBase {}
