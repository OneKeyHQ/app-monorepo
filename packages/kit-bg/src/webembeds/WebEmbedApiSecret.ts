import type {
  IBatchGetPublicKeysAsyncParams,
  IGenerateRootFingerprintHexAsyncParams,
  IMnemonicFromEntropyAsyncParams,
  IMnemonicToSeedAsyncParams,
  ISecretPublicKeyInfoSerialized,
} from '@onekeyhq/core/src/secret';
import {
  batchGetPublicKeysAsync,
  generateRootFingerprintHex,
  mnemonicFromEntropyAsync,
  mnemonicToSeedAsync,
} from '@onekeyhq/core/src/secret';

class WebEmbedApiSecret {
  async batchGetPublicKeys(
    params: IBatchGetPublicKeysAsyncParams,
  ): Promise<ISecretPublicKeyInfoSerialized[]> {
    const keys = await batchGetPublicKeysAsync(params);

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

  async generateRootFingerprintHex(
    params: IGenerateRootFingerprintHexAsyncParams,
  ): Promise<string> {
    return generateRootFingerprintHex(params);
  }
}

export default WebEmbedApiSecret;
