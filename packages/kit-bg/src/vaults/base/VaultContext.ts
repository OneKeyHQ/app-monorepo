/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, max-classes-per-file */
import { SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';
import numberUtils from '@onekeyhq/shared/src/utils/numberUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import localDb from '../../dbs/local/localDb';
import {
  mockGetChainInfo,
  mockGetNetwork,
  mockGetWalletIdFromAccountId,
} from '../mock';

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
      this._dbAccount = await localDb.getAccount(this.accountId);
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

  // TODO move to utils
  async getNetworkChainId({ hex = false }: { hex?: boolean } = {}) {
    const [impl, chainId] = this.networkId.split(SEPERATOR);
    return hex ? numberUtils.numberToHex(chainId) : chainId;
  }

  async getNetworkImpl() {
    const [impl, chainId] = this.networkId.split(SEPERATOR);
    return impl;
  }

  async getChainInfo() {
    return mockGetChainInfo({ networkId: this.networkId });
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
