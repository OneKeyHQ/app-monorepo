import type {
  IBatchGetPublicKeysParams,
  IDecryptAsyncParams,
  IEncryptAsyncParams,
  IGenerateRootFingerprintHexAsyncParams,
  IMnemonicFromEntropyAsyncParams,
  IMnemonicToSeedAsyncParams,
  ISecretPublicKeyInfoSerialized,
} from '@onekeyhq/core/src/secret';
import {
  batchGetPublicKeys,
  decryptAsync,
  encryptAsync,
  generateRootFingerprintHexAsync,
  mnemonicFromEntropyAsync,
  mnemonicToSeedAsync,
  tonMnemonicToKeyPairFn,
  tonValidateMnemonicFn,
} from '@onekeyhq/core/src/secret';

class WebEmbedApiSecret {
  async encryptAsync(
    params: Omit<IEncryptAsyncParams, 'data'> & {
      data: string;
    },
  ): Promise<string> {
    return (await encryptAsync(params)).toString('hex');
  }

  async decryptAsync(
    params: Omit<IDecryptAsyncParams, 'data'> & {
      data: string;
    },
  ): Promise<string> {
    return (await decryptAsync(params)).toString('hex');
  }

  async batchGetPublicKeys(
    params: IBatchGetPublicKeysParams,
  ): Promise<ISecretPublicKeyInfoSerialized[]> {
    const keys = await batchGetPublicKeys(params);

    return keys.map((key) => ({
      path: key.path,
      parentFingerPrint: key.parentFingerPrint.toString('hex'),
      extendedKey: {
        key: key.extendedKey.key.toString('hex'),
        chainCode: key.extendedKey.chainCode.toString('hex'),
      },
    }));
  }

  async mnemonicFromEntropyAsync(
    params: IMnemonicFromEntropyAsyncParams,
  ): Promise<string> {
    return mnemonicFromEntropyAsync(params);
  }

  async mnemonicToSeedAsync(
    params: IMnemonicToSeedAsyncParams,
  ): Promise<string> {
    const seed = await mnemonicToSeedAsync(params);
    return seed.toString('hex');
  }

  async generateRootFingerprintHexAsync(
    params: IGenerateRootFingerprintHexAsyncParams,
  ): Promise<string> {
    return generateRootFingerprintHexAsync(params);
  }

  async tonValidateMnemonic(
    mnemonicArray: string[],
    password?: string,
    wordlist?: string[],
  ): Promise<boolean> {
    return tonValidateMnemonicFn(mnemonicArray, password, wordlist);
  }

  async tonMnemonicToKeyPair(
    mnemonicArray: string[],
    password?: string,
  ): Promise<ReturnType<typeof tonMnemonicToKeyPairFn>> {
    return tonMnemonicToKeyPairFn(mnemonicArray, password);
  }
}

export default WebEmbedApiSecret;
