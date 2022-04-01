/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { SEPERATOR } from '../constants';
import { getWalletIdFromAccountId } from '../managers/account';

import type { Engine } from '../index';
import type { IVaultOptions } from '../types/vault';

// TODO rename to VaultContext
export class EngineVaultTools {
  constructor(options: IVaultOptions) {
    this.options = options;
    this.engine = options.engine;
    this.networkId = options.networkId;
    this.accountId = options.accountId;
  }

  options: IVaultOptions;

  // TODO use get() instead
  networkId: string; // "evm--97"

  accountId: string; // "hd-1--m/44'/60'/0'/0/0"

  engine: Engine;

  // TODO use async init() all extra fields
  async getNetworkChainId() {
    const [impl, chainId] = this.networkId.split(SEPERATOR);
    return chainId;
  }

  async getNetworkImpl() {
    const [impl, chainId] = this.networkId.split(SEPERATOR);
    return impl;
  }

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

  async getWalletId() {
    // "hd-1--m/44'/60'/0'/0/0" ---> "hd-1"
    return getWalletIdFromAccountId(this.accountId);
  }
}
