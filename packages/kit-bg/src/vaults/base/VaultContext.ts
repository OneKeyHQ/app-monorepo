/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, max-classes-per-file */
import type { ICoreApiNetworkInfo } from '@onekeyhq/core/src/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { getVaultSettings, getVaultSettingsNetworkInfo } from '../settings';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBWalletId } from '../../dbs/local/types';
import type { IVaultOptions } from '../types';

export class VaultContext {
  constructor(options: IVaultOptions) {
    this.options = options;
    this.networkId = options.networkId || '';
    this.accountId = options.accountId || '';
    this.backgroundApi = options.backgroundApi;
    this.walletId =
      options.walletId ||
      (this.accountId
        ? accountUtils.getWalletIdFromAccountId({ accountId: this.accountId })
        : '');
    if (!this.walletId && !this.options.isChainOnly) {
      throw new Error('can not get correct walletId');
    }
  }

  backgroundApi: IBackgroundApi;

  options: IVaultOptions;

  networkId: string; // "evm--97"

  walletId: IDBWalletId;

  accountId: string; // "hd-1--m/44'/60'/0'/0/0"

  _network!: IServerNetwork;

  // getAccount() moved to VaultBase

  async getNetworkId() {
    return this.networkId;
  }

  async getNetwork({ cached }: { cached?: boolean } = {}) {
    if (!cached || !this._network || this._network.id !== this.networkId) {
      const network = await this.backgroundApi.serviceNetwork.getNetwork({
        networkId: this.networkId,
      });
      this._network = network;
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

  async getVaultSettings() {
    return getVaultSettings({ networkId: this.networkId });
  }

  async getNetworkInfo() {
    return getVaultSettingsNetworkInfo({ networkId: this.networkId });
  }

  async getCoreApiNetworkInfo(): Promise<ICoreApiNetworkInfo> {
    const network = await this.getNetwork();
    const networkInfo = await this.getNetworkInfo();
    // check presetNetworks.extensions.providerOptions
    const { addressPrefix, curve } = networkInfo;
    const networkImpl = await this.getNetworkImpl();
    const chainId = await this.getNetworkChainId();
    const { isTestnet } = network;
    const { networkId } = this;
    return {
      isTestnet,
      networkChainCode: networkImpl,
      chainId,
      networkId,
      networkImpl,
      addressPrefix,
      curve,
    };
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
