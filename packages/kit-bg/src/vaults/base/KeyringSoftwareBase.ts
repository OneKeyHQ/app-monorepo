import { isNil } from 'lodash';

import { decryptImportedCredential } from '@onekeyhq/core/src/secret';
import type {
  ICoreCredentialsInfo,
  ICoreHdCredentialEncryptHex,
  ICoreImportedCredentialEncryptHex,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';

import localDb from '../../dbs/local/localDb';

import { KeyringBase } from './KeyringBase';

import type { EDBAccountType } from '../../dbs/local/consts';
import type {
  IDBSimpleAccount,
  IDBUtxoAccount,
  IDBVariantAccount,
} from '../../dbs/local/types';
import type VaultBtc from '../impls/btc/Vault';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsOptions,
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

  async baseSignTransactionBtc(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }

    const vault = this.vault as VaultBtc;

    const { password, unsignedTx } = params;

    const credentials = await this.baseGetCredentialsInfo(params);

    const networkInfo = await this.getCoreApiNetworkInfo();

    const { account, btcExtraInfo } = await vault.prepareBtcSignExtraInfo({
      unsignedTx,
    });

    const result = await this.coreApi.signTransaction({
      networkInfo,
      unsignedTx,
      account,
      password,
      credentials,
      btcExtraInfo, // TODO move btcExtraInfo to unsignedTx
    });
    return result;
  }

  async baseSignTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }

    const { password, unsignedTx } = params;
    const account = await this.vault.getAccount();

    const credentials = await this.baseGetCredentialsInfo(params);

    const networkInfo = await this.getCoreApiNetworkInfo();

    const result = await this.coreApi.signTransaction({
      networkInfo,
      unsignedTx,
      account,
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
    const account = await this.vault.getAccount();

    const credentials = await this.baseGetCredentialsInfo(params);
    const networkInfo = await this.getCoreApiNetworkInfo();

    const result = await Promise.all(
      messages.map((msg) =>
        checkIsDefined(this.coreApi).signMessage({
          networkInfo,
          unsignedMsg: msg,
          account,
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
    const account = await this.vault.getAccount();
    const credentials = await this.baseGetCredentialsInfo({ password });
    const networkInfo = await this.getCoreApiNetworkInfo();

    const privateKeys = await this.coreApi.getPrivateKeys({
      networkInfo,
      password,
      account: { ...account, relPaths },
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
      accountType?: EDBAccountType;
      impl?: string;
      coinType?: string;
    } = {},
  ): Promise<Array<IDBSimpleAccount>> {
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }
    const { name, importedCredential, password, createAtNetwork } = params;
    const { privateKey } = decryptImportedCredential({
      credential: importedCredential,
      password,
    });
    const settings = await this.getVaultSettings();

    const accountType = options.accountType || settings.accountType;
    const impl = options.impl || settings.impl;
    const coinType =
      options.coinType ||
      params.deriveInfo?.coinType ||
      settings.coinTypeDefault;

    const networkInfo = await this.getCoreApiNetworkInfo();

    const privateKeyRaw = privateKey;
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
        impl,
        createAtNetwork,
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
    const { name, importedCredential, password } = params;
    const { privateKey } = decryptImportedCredential({
      credential: importedCredential,
      password,
    });

    const { coinType, accountType } = options;

    const settings = await this.getVaultSettings();
    const networkInfo = await this.getCoreApiNetworkInfo();

    const privateKeyRaw = privateKey;
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
        impl: settings.impl,
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
  ): Promise<Array<IDBSimpleAccount | IDBVariantAccount>> {
    const { addressEncoding, template } = params.deriveInfo;
    const { password } = params;
    const networkInfo = await this.getCoreApiNetworkInfo();

    return this.basePrepareHdNormalAccounts(params, {
      addressEncoding,
      buildAddressesInfo: async ({ usedIndexes }) => {
        if (!this.coreApi) {
          throw new Error('coreApi is not defined');
        }
        const credentials = await this.baseGetCredentialsInfo({ password });
        const { addresses: addressInfos } =
          await this.coreApi.getAddressesFromHd({
            networkInfo,
            template,
            hdCredential: checkIsDefined(credentials.hd),
            password,
            indexes: usedIndexes,
          });
        return addressInfos;
      },
    });
  }

  async basePrepareAccountsHdUtxo(
    params: IPrepareHdAccountsParams,
    options: Omit<IPrepareHdAccountsOptions, 'buildAddressesInfo'>,
  ): Promise<IDBUtxoAccount[]> {
    return this.basePrepareHdUtxoAccounts(params, {
      ...options,
      buildAddressesInfo: async ({ usedIndexes }) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, indexes, deriveInfo, names, skipCheckAccountExist } =
          params;
        const { addressEncoding } = options;
        checkIsDefined(addressEncoding);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { coinType, template, namePrefix } = deriveInfo;
        const credentials = await this.baseGetCredentialsInfo({ password });
        if (!this.coreApi) {
          throw new Error('coreApi is undefined');
        }
        const { addresses: addressesInfo } =
          await this.coreApi.getAddressesFromHd({
            networkInfo: await this.getCoreApiNetworkInfo(),
            template,
            hdCredential: checkIsDefined(credentials.hd),
            password,
            indexes: usedIndexes,
            addressEncoding,
          });

        if (addressesInfo.length !== usedIndexes.length) {
          throw new OneKeyInternalError('Unable to get address');
        }
        return addressesInfo;
      },
    });
  }

  // TODO import type { Signer } from '../../proxy';
  abstract getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult>;
}
