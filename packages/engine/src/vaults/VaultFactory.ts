/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, new-cap */

import { createVaultInstance } from './factory';

import type { Engine } from '../index';
import type { IVaultFactoryOptions } from '../types/vault';
import type { VaultBase } from './VaultBase';

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

  getChainOnlyVault(networkId: string): Promise<VaultBase> {
    // This in fact returns a watching vault.
    return this.getVault({ networkId, accountId: '' });
  }
}
