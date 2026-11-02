import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import {
  SPARK_ACCOUNT_INDEX,
  SPARK_ACCOUNT_PATH,
  deriveSparkChildMnemonicFromHdCredential,
  getSparkAccountFromChildMnemonic,
  getSparkNetworkFromImpl,
} from './utils';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiGetExportedSecretKey,
  ICoreApiPrivateKeysMap,
  ISignedTxPro,
} from '../../types';

/**
 * Spark keys live inside the Breez SDK, which is connected with the BIP-85
 * child mnemonic. This class only computes account addresses; signing,
 * key export and imported keys are not supported.
 */
export default class CoreChainSoftware extends CoreChainApiBase {
  override getExportedSecretKey(
    _query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    throw new NotImplemented();
  }

  override async getPrivateKeys(): Promise<ICoreApiPrivateKeysMap> {
    throw new NotImplemented();
  }

  override async signTransaction(): Promise<ISignedTxPro> {
    throw new NotImplemented();
  }

  override async signMessage(): Promise<string> {
    throw new NotImplemented();
  }

  override async getAddressFromPrivate(): Promise<ICoreApiGetAddressItem> {
    throw new NotImplemented();
  }

  override async getAddressFromPublic(): Promise<ICoreApiGetAddressItem> {
    throw new NotImplemented();
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    const {
      networkInfo,
      indexes,
      hdCredential,
      password,
      hdCredentialCacheScopeId,
      kdfBackend,
      enablePbkdf2Cache,
    } = query;
    if (indexes.some((index) => index !== SPARK_ACCOUNT_INDEX)) {
      throw new OneKeyLocalError('Spark supports only one account per wallet');
    }
    const network = getSparkNetworkFromImpl(networkInfo.networkImpl);
    const childMnemonic = await deriveSparkChildMnemonicFromHdCredential({
      hdCredential,
      password,
      hdCredentialCacheScopeId,
      kdfBackend,
      enablePbkdf2Cache,
    });
    const { publicKey, address } = getSparkAccountFromChildMnemonic({
      childMnemonic,
      network,
    });
    return {
      addresses: indexes.map(() => ({
        address,
        publicKey,
        path: SPARK_ACCOUNT_PATH,
        __hwExtraInfo__: undefined,
      })),
    };
  }
}
