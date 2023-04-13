import { batchGetPrivateKeys } from '@onekeyhq/engine/src/secret';

import { OneKeyInternalError } from '../../errors';

import { KeyringSoftwareBase } from './KeyringSoftwareBase';

import type { ExportedSeedCredential } from '../../dbs/base';
import type { DBAccount } from '../../types/account';
import type { IPrepareAccountByAddressIndexParams } from '../types';

export abstract class KeyringHdBase extends KeyringSoftwareBase {
  override async getPrivateKeys(
    password: string,
    relPaths?: Array<string>,
  ): Promise<Record<string, Buffer>> {
    const dbAccount = await this.getDbAccount();
    const pathComponents = dbAccount.path.split('/');
    const usedRelativePaths = relPaths || [pathComponents.pop() as string];
    const basePath = pathComponents.join('/');

    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    if (typeof seed === 'undefined') {
      throw new OneKeyInternalError('Unable to get credential.');
    }

    const { curve } = await this.engine.providerManager.getChainInfoByNetworkId(
      this.networkId,
    );

    const keys = batchGetPrivateKeys(
      curve,
      seed,
      password,
      basePath,
      usedRelativePaths,
    );
    return keys.reduce(
      (ret, key) => ({ ...ret, [key.path]: key.extendedKey.key }),
      {},
    );
  }

  override getAddress(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override batchGetAddress(): Promise<{ path: string; address: string }[]> {
    throw new Error('Method not implemented.');
  }

  override prepareAccountByAddressIndex(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: IPrepareAccountByAddressIndexParams,
  ): Promise<DBAccount[]> {
    throw new Error('Method not implemented.');
  }
}
