import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { ensureRunOnBackground } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IMemoizeeOptions } from '@onekeyhq/shared/src/utils/cacheUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { mockIsAccountCompatibleWithNetwork } from '../../mock';

import type { VaultBase, VaultBaseChainOnly } from './VaultBase';
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

  vaultCreator: (options: IVaultOptions) => Promise<VaultBase>;

  getVaultWithoutCache = async ({
    networkId,
    accountId,
    walletId,
  }: IVaultFactoryOptions): Promise<VaultBase> => {
    const options = {
      networkId,
      accountId,
      walletId,
      // TODO reCreate rpc client when rpcURL changed
    };
    const vault: VaultBase = await this.vaultCreator(options);
    return vault;
  };

  getVault = memoizee(
    async ({
      networkId,
      accountId,
    }: Omit<IVaultFactoryOptions, 'walletId'>): Promise<VaultBase> => {
      if (
        accountId &&
        networkId &&
        !mockIsAccountCompatibleWithNetwork({ accountId, networkId })
      ) {
        throw new OneKeyInternalError(
          `NetworkId and AccountId are incompatible: accountId=${accountId}, networkId=${networkId}`,
        );
      }

      return this.getVaultWithoutCache({
        networkId,
        accountId,
      });
    },
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
      walletId: string;
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
