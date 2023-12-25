/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, max-classes-per-file */
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import localDb from '../../dbs/local/localDb';
import { mockGetNetwork, mockGetWalletIdFromAccountId } from '../../mock';
import { getVaultSettingsNetworkInfo } from '../settings';

import type { IDBAccount, IDBWalletId } from '../../dbs/local/types';
import type { IVaultFactoryOptions } from '../types';

export class VaultContext {
  constructor(options: IVaultFactoryOptions) {
    this.options = options;
    this.networkId = options.networkId || '';
    this.accountId = options.accountId || '';
    this.walletId =
      options.walletId ||
      (this.accountId
        ? mockGetWalletIdFromAccountId({ accountId: this.accountId })
        : '');
    if (!this.walletId) {
      throw new Error('can not get correct walletId');
    }
  }

  options: IVaultFactoryOptions;

  networkId: string; // "evm--97"

  walletId: IDBWalletId;

  accountId: string; // "hd-1--m/44'/60'/0'/0/0"

  _dbAccount!: IDBAccount;

  // TODO resetCache after dbAccount and network DB updated

  async getDbAccount(params?: { noCache?: boolean }): Promise<IDBAccount> {
    const { noCache } = { noCache: false, ...params };
    if (noCache || !this._dbAccount || this._dbAccount.id !== this.accountId) {
      this._dbAccount = await localDb.getAccount({ accountId: this.accountId });
    }

    // let { address, type } = this._dbAccount;
    // if (
    //   type === AccountType.VARIANT &&
    //   mockIsAccountCompatibleWithNetwork({
    //     accountId: this.accountId,
    //     networkId: this.networkId,
    //   })
    // ) {
    //   address = await this.addressFromBase(this._dbAccount);
    // }

    const { address } = this._dbAccount;

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

  _network!: IServerNetwork;

  async getNetwork({ cached }: { cached?: boolean } = {}) {
    if (!cached || !this._network || this._network.id !== this.networkId) {
      this._network = await mockGetNetwork({ networkId: this.networkId });
    }
    return this._network;
  }

  async getNetworkChainId({ hex = false }: { hex?: boolean } = {}) {
    return networkUtils.getNetworkChainId({
      networkId: this.networkId,
      hex,
    });
  }

  async getNetworkImpl() {
    return networkUtils.getNetworkImpl({ networkId: this.networkId });
  }

  async getNetworkInfo() {
    return getVaultSettingsNetworkInfo({ networkId: this.networkId });
  }

  async getRpcUrl() {
    return (await this.getNetwork({ cached: false })).rpcURLs[0]?.url;
  }

  // async getClientApi<T>() {
  //   return (await this.getNetwork({ cached: false })).clientApi as T;
  // }

  async destroy() {
    // Do nothing
  }
}
