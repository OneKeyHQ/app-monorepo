import { merge } from 'lodash';

import { slicePathTemplate } from '@onekeyhq/engine/src/managers/derivation';
import { ChainSigner } from '@onekeyhq/engine/src/proxy';
import type {
  ISecretPrivateKeyInfo,
  ISecretPublicKeyInfo,
} from '@onekeyhq/engine/src/secret';
import {
  type ICurveName,
  batchGetPrivateKeys,
  batchGetPublicKeys,
} from '@onekeyhq/engine/src/secret';
import {
  ed25519,
  nistp256,
  secp256k1,
} from '@onekeyhq/engine/src/secret/curves';
import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type { Signer as ISigner } from '@onekeyhq/engine/src/types/secret';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiGetPrivateKeysMapQuery as ICoreApiGetPrivateKeysMapHdQuery,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
} from '../types';

export abstract class CoreChainApiBase {
  protected baseGetCurve(curveName: ICurveName) {
    switch (curveName) {
      case 'ed25519':
        return ed25519;
      case 'secp256k1':
        return secp256k1;
      case 'nistp256':
        return nistp256;
      default:
        throw new OneKeyInternalError('Unsupported curve');
    }
  }

  protected async baseCreateSigner({
    curve,
    privateKey,
    password,
  }: {
    curve: ICurveName;
    privateKey: string; // encryptedPrivateKey by password
    password: string;
  }): Promise<ISigner> {
    if (typeof password === 'undefined') {
      throw new OneKeyInternalError('Software signing requires a password.');
    }
    const privateKeyBuffer = bufferUtils.toBuffer(privateKey);
    return Promise.resolve(new ChainSigner(privateKeyBuffer, password, curve));
  }

  protected async baseGetSingleSigner({
    payload,
    curve,
  }: {
    payload: ICoreApiSignBasePayload;
    curve: ICurveName;
  }) {
    const privateKeys = await this.getPrivateKeys(payload);
    const privateKey = privateKeys[payload.account.path];
    return this.baseCreateSigner({
      curve,
      privateKey,
      password: payload.password,
    });
  }

  protected async baseGetPrivateKeys({
    payload,
    curve,
  }: {
    payload: ICoreApiSignBasePayload;
    curve: ICurveName;
  }): Promise<ICoreApiPrivateKeysMap> {
    const { credentials, account, password } = payload;
    let privateKeys: ICoreApiPrivateKeysMap = {};
    if (credentials.hd) {
      const { relPaths } = account;
      const { seed } = credentials.hd;
      privateKeys = await this.baseGetPrivateKeysHd({
        curve,
        account,
        seed,
        password,
        relPaths,
      });
    }
    if (credentials.imported) {
      // TODO handle relPaths privateKey here
      const { relPaths } = account;
      const { privateKey } = credentials.imported;
      privateKeys[account.path] = privateKey;
    }
    if (!Object.keys(privateKeys).length) {
      throw new Error('No private keys found');
    }
    return privateKeys;
  }

  protected async baseGetPrivateKeysHd({
    curve,
    password,
    account,
    relPaths,
    seed,
  }: ICoreApiGetPrivateKeysMapHdQuery & {
    curve: ICurveName;
  }): Promise<ICoreApiPrivateKeysMap> {
    const { path, address } = account;
    const seedBuffer = bufferUtils.toBuffer(seed);
    const pathComponents = path.split('/');
    const usedRelativePaths = relPaths || [pathComponents.pop() as string];
    const basePath = pathComponents.join('/');

    if (usedRelativePaths.length === 0) {
      throw new OneKeyInternalError(
        'getPrivateKeysHd ERROR: relPaths is empty.',
      );
    }

    const keys = batchGetPrivateKeys(
      curve,
      seedBuffer,
      password,
      basePath,
      usedRelativePaths,
    );
    const map: ICoreApiPrivateKeysMap = keys.reduce((ret, key) => {
      const result: ICoreApiPrivateKeysMap = {
        ...ret,
        [key.path]: bufferUtils.bytesToHex(key.extendedKey.key),
      };
      return result;
    }, {} as ICoreApiPrivateKeysMap);
    return map;
  }

  protected async baseGetAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
    options: {
      curve: ICurveName;
      generateFrom?: 'publicKey' | 'privateKey';
    },
  ): Promise<ICoreApiGetAddressesResult> {
    const { curve, generateFrom } = options;
    const { template, hdCredential, password, indexes, networkInfo } = query;
    const { seed } = hdCredential;
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);
    const seedBuffer = bufferUtils.toBuffer(seed);
    const indexFormatted = indexes.map((index) =>
      pathSuffix.replace('{index}', index.toString()),
    );
    const isPrivateKeyMode = generateFrom === 'privateKey';
    let pubkeyInfos: ISecretPublicKeyInfo[] = [];
    let pvtkeyInfos: ISecretPrivateKeyInfo[] = [];

    if (isPrivateKeyMode) {
      pvtkeyInfos = batchGetPrivateKeys(
        curve,
        seedBuffer,
        password,
        pathPrefix,
        indexFormatted,
      );
    } else {
      pubkeyInfos = batchGetPublicKeys(
        curve,
        seedBuffer,
        password,
        pathPrefix,
        indexFormatted,
      );
    }
    const infos = isPrivateKeyMode ? pvtkeyInfos : pubkeyInfos;
    if (infos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }
    const addresses = await Promise.all(
      infos.map(async (info: ISecretPublicKeyInfo | ISecretPrivateKeyInfo) => {
        const {
          path,
          extendedKey: { key },
        } = info;
        let publicKey: string | undefined;
        let result: ICoreApiGetAddressItem | undefined;

        if (isPrivateKeyMode) {
          const privateKeyRaw = bufferUtils.bytesToHex(decrypt(password, key));
          result = await this.getAddressFromPrivate({
            privateKeyRaw,
            networkInfo: query.networkInfo,
          });
        } else {
          publicKey = key.toString('hex');
          result = await this.getAddressFromPublic({
            publicKey,
            networkInfo: query.networkInfo,
          });
        }

        return merge({ publicKey, path }, result);
      }),
    );
    return { addresses };
  }

  // ----------------------------------------------

  abstract getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap>;

  abstract signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro>;

  abstract signMessage(payload: ICoreApiSignMsgPayload): Promise<string>;

  abstract getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem>;

  abstract getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult>;

  abstract getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem>;
}
