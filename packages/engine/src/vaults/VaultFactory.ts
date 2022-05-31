/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, new-cap */

import memoizee from 'memoizee';

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
  }: IVaultFactoryOptions): Promise<VaultBase> => {
    const options = {
      networkId,
      accountId,
      walletId,
      engine: this.engine,
    };
    const vault: VaultBase = await createVaultInstance(options);
    return vault;
  };

  getVault = memoizee(
    async ({
      networkId,
      accountId,
    }: IVaultFactoryOptions): Promise<VaultBase> =>
      this._getVaultWithoutCache({ networkId, accountId }),
    {
      promise: true,
      primitive: true,
      normalizer: (args) => JSON.stringify(args),
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
      normalizer: (args) => `${args[0]}`,
      max: 1,
      maxAge: 1000 * 60 * 15,
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
      normalizer: (args) => `${args[0]}:${args[1]}`,
      max: 1,
      maxAge: 1000 * 60 * 15,
    },
  );
}
