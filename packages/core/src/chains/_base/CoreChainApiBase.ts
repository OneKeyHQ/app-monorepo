import { ChainSigner } from '@onekeyhq/engine/src/proxy';
import {
  type CurveName,
  batchGetPrivateKeys,
} from '@onekeyhq/engine/src/secret';
import type { Signer as ISigner } from '@onekeyhq/engine/src/types/secret';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiGetPrivateKeysMapQuery as ICoreApiGetPrivateKeysMapHdQuery,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
} from '../../types';

export abstract class CoreChainApiBase {
  protected async baseGetChainSigner({
    curve,
    privateKey,
    password,
  }: {
    curve: CurveName;
    privateKey: string; // encryptedPrivateKey by password
    password: string;
  }): Promise<ISigner> {
    if (typeof password === 'undefined') {
      throw new OneKeyInternalError('Software signing requires a password.');
    }
    const privateKeyBuffer = bufferUtils.toBuffer(privateKey);
    return Promise.resolve(new ChainSigner(privateKeyBuffer, password, curve));
  }

  protected async baseGetPrivateKeys({
    payload,
    curve,
  }: {
    payload: ICoreApiSignBasePayload;
    curve: CurveName;
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
    curve: CurveName;
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

  abstract signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro>;

  abstract signMessage(query: ICoreApiSignMsgPayload): Promise<string>;

  abstract getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem>;

  abstract getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult>;

  abstract getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap>;
}
