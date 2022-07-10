import { batchGetPrivateKeys } from '@onekeyfe/blockchain-libs/dist/secret';

import { ExportedSeedCredential } from '../../dbs/base';
import { OneKeyInternalError } from '../../errors';

import { KeyringSoftwareBase } from './KeyringSoftwareBase';

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

    const provider = await this.engine.providerManager.getProvider(
      this.networkId,
    );

    const keys = batchGetPrivateKeys(
      provider.chainInfo.curve,
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
}
