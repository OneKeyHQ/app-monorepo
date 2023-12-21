import { isNil } from 'lodash';

import type {
  EAddressEncodings,
  ICoreCredentialsInfo,
  ICoreHdCredentialEncryptHex,
  ICoreImportedCredentialEncryptHex,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { wait } from '@onekeyhq/kit/src/utils/helper';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';

import { EDBAccountType } from '../../dbs/local/consts';
import localDb from '../../dbs/local/localDb';

import { KeyringBase } from './KeyringBase';

import type {
  IDBSimpleAccount,
  IDBUtxoAccount,
  IDBVariantAccount,
} from '../../dbs/local/types';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  IPrepareImportedAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../types';

export abstract class KeyringSoftwareBase extends KeyringBase {
  async baseGetCredentialsInfo({
    password,
  }: {
    password: string;
  }): Promise<ICoreCredentialsInfo> {
    noopObject(password);
    let hd: ICoreHdCredentialEncryptHex | undefined;
    let imported: ICoreImportedCredentialEncryptHex | undefined;

    // hd
    if (this.isKeyringHd()) {
      const credential = await localDb.getCredential(
        checkIsDefined(this.walletId),
      );
      hd = credential.credential;
    }

    // imported
    if (this.isKeyringImported()) {
      const credential = await localDb.getCredential(this.accountId);
      imported = credential.credential;
    }

    return {
      hd,
      imported,
    };
  }

  async baseSignTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }

    const { password, unsignedTx } = params;
    const dbAccount = await this.getDbAccount();

    const credentials = await this.baseGetCredentialsInfo(params);

    const networkInfo = await this.baseGetCoreApiNetworkInfo();

    const result = await this.coreApi.signTransaction({
      networkInfo,
      unsignedTx,
      account: dbAccount,
      password,
      credentials,
    });
    return result;
  }

  async baseSignMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }
    const { password, messages } = params;
    const dbAccount = await this.getDbAccount();

    const credentials = await this.baseGetCredentialsInfo(params);
    const networkInfo = await this.baseGetCoreApiNetworkInfo();

    const result = await Promise.all(
      messages.map((msg) =>
        checkIsDefined(this.coreApi).signMessage({
          networkInfo,
          unsignedMsg: msg,
          account: dbAccount,
          password,
          credentials,
        }),
      ),
    );
    return result;
  }

  async baseGetPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    const { password, relPaths } = params;
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }
    const dbAccount = await this.getDbAccount();
    const credentials = await this.baseGetCredentialsInfo({ password });
    const networkInfo = await this.baseGetCoreApiNetworkInfo();

    const privateKeys = await this.coreApi.getPrivateKeys({
      networkInfo,
      password,
      account: { ...dbAccount, relPaths },
      credentials,
    });
    const result: IGetPrivateKeysResult = {};
    Object.entries(privateKeys).forEach(([path, privateKey]) => {
      result[path] = bufferUtils.toBuffer(privateKey);
    }, {});
    return result;
  }

  async basePrepareAccountsImported(
    params: IPrepareImportedAccountsParams,
    options: {
      coinType: string;
      accountType: EDBAccountType;
    },
  ): Promise<Array<IDBSimpleAccount>> {
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }
    const { name, privateKey } = params;
    const { coinType, accountType } = options;

    const networkInfo = await this.baseGetCoreApiNetworkInfo();

    const privateKeyRaw = bufferUtils.bytesToHex(privateKey);
    const { address, addresses, publicKey } =
      await this.coreApi.getAddressFromPrivate({
        networkInfo,
        privateKeyRaw,
      });

    return Promise.resolve([
      {
        id: `imported--${coinType}--${publicKey}`,
        name: name || '',
        type: accountType,
        path: '',
        coinType,
        pub: publicKey,
        address,
        addresses,
      },
    ]);
  }

  async basePrepareAccountsImportedUtxo(
    params: IPrepareImportedAccountsParams,
    options: {
      coinType: string;
      accountType: EDBAccountType;
    },
  ): Promise<Array<IDBUtxoAccount>> {
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }
    const { name, privateKey } = params;
    const { coinType, accountType } = options;

    const networkInfo = await this.baseGetCoreApiNetworkInfo();

    const privateKeyRaw = bufferUtils.bytesToHex(privateKey);
    const { address, addresses, publicKey, xpub, path, xpubSegwit } =
      await this.coreApi.getAddressFromPrivate({
        networkInfo,
        privateKeyRaw,
      });

    if (isNil(path) || isNil(xpub) || !addresses) {
      throw new Error('path or xpub or addresses is undefined');
    }

    return Promise.resolve([
      {
        id: `imported--${coinType}--${xpub || address}`,
        name: name || '',
        type: accountType,
        path,
        coinType,
        xpub,
        xpubSegwit,
        pub: publicKey,
        address,
        addresses,
      },
    ]);
  }

  async basePrepareAccountsHd(
    params: IPrepareHdAccountsParams,
    options: {
      accountType: EDBAccountType;
      usedIndexes: number[];
    },
  ): Promise<Array<IDBSimpleAccount | IDBVariantAccount>> {
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }
    const { password, names, deriveInfo } = params;
    const { coinType, template, namePrefix, idSuffix } = deriveInfo;
    if (!coinType) {
      throw new Error('coinType is not defined');
    }
    if (!this.walletId) {
      throw new Error('walletId is not defined');
    }
    const { accountType, usedIndexes } = options;

    const networkInfo = await this.baseGetCoreApiNetworkInfo();

    const credentials = await this.baseGetCredentialsInfo({ password });
    const { addresses: addressInfos } = await this.coreApi.getAddressesFromHd({
      networkInfo,
      template,
      hdCredential: checkIsDefined(credentials.hd),
      password,
      indexes: usedIndexes,
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

  async basePrepareAccountsHdUtxo(
    params: IPrepareHdAccountsParams,
    options: {
      addressEncoding?: EAddressEncodings;
      checkIsAccountUsed: (query: {
        xpub: string;
        xpubSegwit?: string;
        address: string;
      }) => Promise<{ isUsed: boolean }>;
    },
  ): Promise<IDBUtxoAccount[]> {
    if (!this.coreApi) {
      throw new Error('coreApi is undefined');
    }
    if (!this.walletId) {
      throw new Error('walletId is undefined');
    }
    const {
      password,
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
    const { addressEncoding, checkIsAccountUsed } = options;

    const ignoreFirst = indexes[0] !== 0;
    // check first prev non-zero index account existing
    const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];

    const credentials = await this.baseGetCredentialsInfo({ password });
    const { addresses: addressesInfo } = await this.coreApi.getAddressesFromHd({
      networkInfo: await this.baseGetCoreApiNetworkInfo(),
      template,
      hdCredential: checkIsDefined(credentials.hd),
      password,
      indexes: usedIndexes,
      addressEncoding,
    });

    if (addressesInfo.length !== usedIndexes.length) {
      throw new OneKeyInternalError('Unable to get address');
    }

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
      if (!skipCheckAccountExist && !isLast) {
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

  // TODO import type { Signer } from '../../proxy';
  abstract getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult>;
}
