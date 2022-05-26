/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, new-cap */

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

  lastVault: VaultBase | null = null;

  engine: Engine;

  async getVault({
    networkId,
    accountId,
    walletId,
  }: IVaultFactoryOptions): Promise<VaultBase> {
    if (
      this.lastVault &&
      accountId !== '' &&
      this.lastVault.networkId === networkId &&
      this.lastVault.accountId === accountId
    ) {
      return this.lastVault;
    }
    const options = {
      networkId,
      accountId,
      walletId,
      engine: this.engine,
    };
    const vault: VaultBase = await createVaultInstance(options);
    this.lastVault = vault;
    return vault;
  }

  getChainOnlyVault(networkId: string): Promise<VaultBaseChainOnly> {
    // This in fact returns a watching vault.
    return this.getVault({ networkId, accountId: '' });
  }
}
