/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, new-cap */

import memoizee from 'memoizee';

import { OneKeyInternalError } from '../errors';
import { isAccountCompatibleWithNetwork } from '../managers/account';

import { createVaultInstance } from './factory';

import type { Engine } from '../index';
import type { IVaultFactoryOptions } from './types';
import type { VaultBase, VaultBaseChainOnly } from './VaultBase';

// TODO debugLogger
// TODO simulate hardware account, solana account
export class VaultFactory {
  constructor({ engine }: { engine: Engine }) {
    this.engine = engine;
  }

  engine: Engine;

  _getVaultWithoutCache = async ({
    networkId,
    accountId,
    walletId,
    rpcURL,
  }: IVaultFactoryOptions & {
    rpcURL?: string;
  }): Promise<VaultBase> => {
    const options = {
      networkId,
      accountId,
      walletId,
      rpcURL,
      engine: this.engine,
    };
    const vault: VaultBase = await createVaultInstance(options);
    return vault;
  };

  getVault = memoizee(
    async ({
      networkId,
      accountId,
      rpcURL,
    }: Omit<IVaultFactoryOptions, 'walletId'> & {
      rpcURL?: string;
    }): Promise<VaultBase> => {
      if (
        accountId &&
        networkId &&
        !isAccountCompatibleWithNetwork(accountId, networkId)
      ) {
        throw new OneKeyInternalError(
          `NetworkId and AccountId are incompatible: accountId=${accountId}, networkId=${networkId}`,
        );
      }

      return this._getVaultWithoutCache({ networkId, accountId, rpcURL });
    },
    {
      promise: true,
      primitive: true,
      normalizer: (...args) => JSON.stringify(args),
      max: 3,
      maxAge: 1000 * 60 * 15,
    },
  );

  getChainOnlyVault = memoizee(
    (networkId: string): Promise<VaultBaseChainOnly> =>
      // This in fact returns a watching vault.
      this._getVaultWithoutCache({ networkId, accountId: '' }),
    {
      promise: true,
      primitive: true,
      max: 1,
      maxAge: 1000 * 60 * 15,
      dispose: async (vault: VaultBaseChainOnly) => {
        // release resources
        await vault.destroy();
      },
    },
  );

  getWalletOnlyVault = memoizee(
    (networkId: string, walletId: string): Promise<VaultBase> =>
      // This in fact returns a watching vault.
      this._getVaultWithoutCache({
        networkId,
        walletId,
        accountId: '',
      }),
    {
      promise: true,
      primitive: true,
      max: 1,
      maxAge: 1000 * 60 * 15,
    },
  );
}
