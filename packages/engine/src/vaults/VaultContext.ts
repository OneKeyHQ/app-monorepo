/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, max-classes-per-file */
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SEPERATOR } from '../constants';
import { getWalletIdFromAccountId } from '../managers/account';

import { IVaultFactoryOptions } from './types';

import type { Engine } from '../index';
import type { IVaultOptions } from './types';

export class VaultContextBase {
  constructor(options: IVaultFactoryOptions) {
    this.options = options;
    this.networkId = options.networkId || '';
    this.accountId = options.accountId || '';
    this.walletId =
      options.walletId ||
      (this.accountId ? getWalletIdFromAccountId(this.accountId) : 'watching');
  }

  options: IVaultFactoryOptions;

  networkId: string; // "evm--97"

  walletId: string;

  accountId: string; // "hd-1--m/44'/60'/0'/0/0"

  async getNetworkChainId() {
    const [impl, chainId] = this.networkId.split(SEPERATOR);
    return chainId;
  }

  async getNetworkImpl() {
    const [impl, chainId] = this.networkId.split(SEPERATOR);
    return impl;
  }
}

export class VaultContext extends VaultContextBase {
  constructor(options: IVaultOptions) {
    super(options);
    this.options = options;
    this.engine = options.engine;
    if (platformEnv.isExtensionUi) {
      throw new Error(
        "Vault can NOT be initialized in UI, it's Background Class only. But you can use VaultHelper in UI.",
      );
    }
  }

  override options: IVaultOptions;

  engine: Engine;

  async getDbAccount() {
    // TODO cache available?
    return this.engine.dbApi.getAccount(this.accountId);
  }

  async getAccountPath() {
    return (await this.getDbAccount()).path;
  }

  async getAccountAddress() {
    return (await this.getDbAccount()).address;
  }

  async getNetwork() {
    // TODO cache available?
    return this.engine.getNetwork(this.networkId);
  }
}
