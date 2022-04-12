/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, max-classes-per-file */
import { SEPERATOR } from '../constants';
import { getWalletIdFromAccountId } from '../managers/account';
import { IVaultFactoryOptions } from '../types/vault';

import type { Engine } from '../index';
import type { IVaultOptions } from '../types/vault';

export class VaultContextBase {
  constructor(options: IVaultFactoryOptions) {
    this.options = options;
    this.networkId = options.networkId;
    this.accountId = options.accountId;
  }

  options: IVaultFactoryOptions;

  networkId: string; // "evm--97"

  accountId: string; // "hd-1--m/44'/60'/0'/0/0"

  async getNetworkChainId() {
    const [impl, chainId] = this.networkId.split(SEPERATOR);
    return chainId;
  }

  async getNetworkImpl() {
    const [impl, chainId] = this.networkId.split(SEPERATOR);
    return impl;
  }

  async getWalletId() {
    // "hd-1--m/44'/60'/0'/0/0" ---> "hd-1"
    return getWalletIdFromAccountId(this.accountId);
  }
}

export class VaultContext extends VaultContextBase {
  constructor(options: IVaultOptions) {
    super(options);
    this.options = options;
    this.engine = options.engine;
  }

  options: IVaultOptions;

  engine: Engine;

  async getDbAccount() {
    // TODO cache available?
    return this.engine.dbApi.getAccount(this.accountId);
  }

  async getAccountPath() {
    return (await this.getDbAccount()).path;
  }

  async getNetwork() {
    // TODO cache available?
    return this.engine.getNetwork(this.networkId);
  }
}
