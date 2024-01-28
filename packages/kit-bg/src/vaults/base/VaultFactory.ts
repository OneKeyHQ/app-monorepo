import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { ensureRunOnBackground } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IMemoizeeOptions } from '@onekeyhq/shared/src/utils/cacheUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import type { VaultBase, VaultBaseChainOnly } from './VaultBase';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBWalletId } from '../../dbs/local/types';
import type { IVaultFactoryOptions, IVaultOptions } from '../types';

export class VaultFactory {
  constructor({
    vaultCreator,
  }: {
    vaultCreator: (options: IVaultOptions) => Promise<VaultBase>;
  }) {
    ensureRunOnBackground();
    this.vaultCreator = vaultCreator;
  }

  backgroundApi?: IBackgroundApi;

  vaultCacheOptions: IMemoizeeOptions = {
    promise: true,
    primitive: true,
    max: 1,
    maxAge: getTimeDurationMs({ minute: 15 }),
    dispose: async (vault: VaultBaseChainOnly) => {
      // release resources
      await vault.destroy();
    },
  };

  setBackgroundApi(backgroundApi: IBackgroundApi) {
    this.backgroundApi = backgroundApi;
  }

  vaultCreator: (options: IVaultOptions) => Promise<VaultBase>;

  getVaultWithoutCache = async ({
    networkId,
    accountId,
    walletId,
  }: IVaultFactoryOptions): Promise<VaultBase> => {
    if (!this.backgroundApi) {
      throw new Error('backgroundApi not set yet');
    }
    const options: IVaultOptions = {
      networkId,
      accountId,
      walletId,
      backgroundApi: this.backgroundApi,
    };
    const vault: VaultBase = await this.vaultCreator(options);
    return vault;
  };

  getVault = memoizee(
    async ({
      networkId,
      accountId,
    }: Omit<IVaultFactoryOptions, 'walletId'>): Promise<VaultBase> =>
      // TODO check account and network compatibility
      this.getVaultWithoutCache({
        networkId,
        accountId,
      }),
    {
      ...this.vaultCacheOptions,
      max: 3,
    },
  );

  getChainOnlyVault = memoizee(
    ({ networkId }: { networkId: string }): Promise<VaultBaseChainOnly> =>
      // This in fact returns a watching vault.
      this.getVaultWithoutCache({ networkId, accountId: '' }),
    {
      ...this.vaultCacheOptions,
      max: 1,
    },
  );

  getWalletOnlyVault = memoizee(
    ({
      networkId,
      walletId,
    }: {
      networkId: string;
      walletId: IDBWalletId;
    }): Promise<VaultBase> =>
      // This in fact returns a watching vault.
      this.getVaultWithoutCache({
        networkId,
        walletId,
        accountId: '',
      }),
    {
      ...this.vaultCacheOptions,
      max: 1,
    },
  );
}
