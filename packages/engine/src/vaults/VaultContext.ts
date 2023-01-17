/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, max-classes-per-file */
import { SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NotImplemented } from '../errors';
import {
  getWalletIdFromAccountId,
  isAccountCompatibleWithNetwork,
} from '../managers/account';
import { AccountType } from '../types/account';

import type { Engine } from '../index';
import type { DBAccount, DBVariantAccount } from '../types/account';
import type { Network } from '../types/network';
import type { IVaultFactoryOptions, IVaultOptions } from './types';

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

  _dbAccount!: DBAccount;

  // TODO resetCache after dbAccount and network DB updated

  async getDbAccount(params?: { noCache?: boolean }) {
    const { noCache } = { noCache: false, ...params };
    if (noCache || !this._dbAccount || this._dbAccount.id !== this.accountId) {
      this._dbAccount = await this.engine.dbApi.getAccount(this.accountId);
    }

    let { address, type } = this._dbAccount;
    if (
      type === AccountType.VARIANT &&
      isAccountCompatibleWithNetwork(this.accountId, this.networkId)
    ) {
      const accountAddress = ((this._dbAccount as DBVariantAccount).addresses ||
        {})[this.networkId];

      if (accountAddress) {
        address = accountAddress;
      } else {
        if (typeof address === 'undefined' || address.length === 0) {
          return this._dbAccount;
        }

        address = await this.addressFromBase(address);
      }
    }

    return {
      ...this._dbAccount,
      address,
    };
  }

  async getAccountPath() {
    return (await this.getDbAccount()).path;
  }

  async getAccountAddress() {
    return (await this.getDbAccount()).address;
  }

  async addressFromBase(baseAddress: string): Promise<string> {
    throw new NotImplemented();
  }

  async addressToBase(address: string): Promise<string> {
    throw new NotImplemented();
  }

  _network!: Network;

  async getNetwork({ cached }: { cached?: boolean } = {}) {
    if (!cached || !this._network || this._network.id !== this.networkId) {
      this._network = await this.engine.getNetwork(this.networkId);
    }
    return this._network;
  }

  async getRpcUrl() {
    return (await this.getNetwork({ cached: false })).rpcURL;
  }
}
