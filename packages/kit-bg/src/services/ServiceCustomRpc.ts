import { Semaphore } from 'async-mutex';
import BigNumber from 'bignumber.js';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ENetworkStatus, type IServerNetwork } from '@onekeyhq/shared/types';
import type { IChainListItem } from '@onekeyhq/shared/types/customNetwork';
import type {
  ICustomRpcItem,
  IDBCustomRpc,
  IMeasureRpcStatusParams,
} from '@onekeyhq/shared/types/customRpc';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IToken } from '@onekeyhq/shared/types/token';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceCustomRpc extends ServiceBase {
  private semaphore = new Semaphore(1);

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  /*= ===============================
   *       Custom RPC
   *============================== */
  @backgroundMethod()
  public async addCustomRpc(params: IDBCustomRpc) {
    return this.backgroundApi.simpleDb.customRpc.addCustomRpc({
      rpcInfo: params,
    });
  }

  @backgroundMethod()
  public async deleteCustomRpc(networkId: string) {
    return this.backgroundApi.simpleDb.customRpc.deleteCustomRpc(networkId);
  }

  @backgroundMethod()
  public async updateCustomRpcEnabledStatus(params: {
    networkId: string;
    enabled: boolean;
  }) {
    return this.backgroundApi.simpleDb.customRpc.updateCustomRpcEnabledStatus(
      params,
    );
  }

  @backgroundMethod()
  public async getAllCustomRpc(): Promise<ICustomRpcItem[]> {
    const result =
      await this.backgroundApi.simpleDb.customRpc.getAllCustomRpc();
    const itemsWithNetwork = await Promise.all(
      result.map(async (r) => ({
        ...r,
        network: await this.backgroundApi.serviceNetwork.getNetwork({
          networkId: r.networkId,
        }),
      })),
    );
    return itemsWithNetwork.sort((a, b) =>
      (a.network?.name ?? '').localeCompare(b.network?.name ?? ''),
    );
  }

  @backgroundMethod()
  public async getCustomRpcForNetwork(networkId: string) {
    return this.backgroundApi.simpleDb.customRpc.getCustomRpcForNetwork(
      networkId,
    );
  }

  @backgroundMethod()
  public async measureRpcStatus(
    params: IMeasureRpcStatusParams & { networkId: string },
  ) {
    const vault = await vaultFactory.getChainOnlyVault({
      networkId: params.networkId,
    });
    const result = await vault.getCustomRpcEndpointStatus({
      rpcUrl: params.rpcUrl,
      validateChainId: params.validateChainId,
    });
    return result;
  }

  /*= ===============================
   *       Custom Network
   *============================== */
  @backgroundMethod()
  public async getChainIdByRpcUrl(params: { rpcUrl: string }) {
    const vault = await vaultFactory.getChainOnlyVault({
      networkId: getNetworkIdsMap().eth,
    });
    const result = await vault.getCustomRpcEndpointStatus({
      rpcUrl: params.rpcUrl,
      validateChainId: false,
    });
    return {
      chainId: result.chainId,
    };
  }

  @backgroundMethod()
  public async upsertCustomNetwork(params: {
    networkName: string;
    rpcUrl: string;
    chainId: number;
    symbol: string;
    blockExplorerUrl: string;
  }) {
    const vault = await vaultFactory.getChainOnlyVault({
      networkId: getNetworkIdsMap().eth,
    });
    const { isEIP1559FeeEnabled } = await vault.checkFeeSupportInfo({
      rpcUrl: params.rpcUrl,
    });

    const { chainId } = params;
    const networkId = accountUtils.buildCustomEvmNetworkId({
      chainId: chainId.toString(),
    });
    const networkInfo: IServerNetwork = {
      impl: IMPL_EVM,
      chainId: chainId.toString(),
      id: networkId,
      name: params.networkName,
      symbol: params.symbol,
      code: params.networkName,
      shortcode: params.networkName,
      shortname: params.networkName,
      decimals: 18,
      feeMeta: {
        code: params.networkName,
        decimals: 9,
        symbol: 'Gwei',
        isEIP1559FeeEnabled,
        // TODO: check isWithL1BaseFee
        isWithL1BaseFee: false,
      },
      status: ENetworkStatus.LISTED,
      isTestnet: false,
      logoURI: '',
      defaultEnabled: true,
      backendIndex: false,
      explorerURL: params.blockExplorerUrl,
      isCustomNetwork: true,
    };
    // Insert custom rpc
    await this.addCustomRpc({
      networkId,
      enabled: true,
      rpc: params.rpcUrl,
      isCustomNetwork: true,
    });

    // Insert native token
    const nativeToken: IToken = {
      decimals: 18,
      name: params.symbol,
      symbol: params.symbol,
      address: '', // native token always be empty
      logoURI: '',
      isNative: true,
    };
    await this.backgroundApi.simpleDb.localTokens.updateTokens({
      networkId,
      tokens: [nativeToken],
    });

    // Insert custom network
    await this.backgroundApi.simpleDb.customNetwork.upsertCustomNetwork({
      networkInfo,
    });

    setTimeout(() => {
      void this.backgroundApi.serviceNetwork.clearNetworkVaultSettingsCache();
      appEventBus.emit(EAppEventBusNames.AddedCustomNetwork, undefined);
    }, 500);
  }

  @backgroundMethod()
  public async deleteCustomNetwork(params: {
    networkId: string;
    replaceByServerNetwork?: boolean;
  }) {
    if (params.replaceByServerNetwork) {
      await this.updateCustomRpcEnabledStatus({
        networkId: params.networkId,
        enabled: false,
      });
    } else {
      await this.deleteCustomRpc(params.networkId);
    }
    await this.backgroundApi.simpleDb.customNetwork.deleteCustomNetwork(params);
    setTimeout(() => {
      appEventBus.emit(EAppEventBusNames.AddedCustomNetwork, undefined);
    }, 300);
  }

  @backgroundMethod()
  public async getAllCustomNetworks(): Promise<IServerNetwork[]> {
    return this.backgroundApi.simpleDb.customNetwork.getAllCustomNetworks();
  }

  /*= ===============================
   *       Server Network
   *============================== */
  @backgroundMethod()
  public async getServerNetworks(): Promise<IServerNetwork[]> {
    return this.semaphore.runExclusive(async () => {
      const { networks, lastFetchTime } =
        await this.backgroundApi.simpleDb.serverNetwork.getAllServerNetworks();
      const now = Date.now();

      if (
        !lastFetchTime ||
        now - lastFetchTime >= timerUtils.getTimeDurationMs({ hour: 1 })
      ) {
        return this.fetchNetworkFromServer();
      }
      defaultLogger.account.wallet.getServerNetworks(networks);
      return networks;
    });
  }

  @backgroundMethod()
  public async fetchNetworkFromServer(): Promise<IServerNetwork[]> {
    defaultLogger.account.wallet.fetchNetworkFromServer();
    // Request /wallet/v1/network/list to get all evm networks
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.get<{ data: IServerNetwork[] }>(
      '/wallet/v1/network/list',
      {
        params: {
          onlyEvmNetworks: true,
        },
      },
    );

    const serverNetworks = resp.data.data;
    const presetNetworkIds = Object.values(getNetworkIdsMap());
    // filter preset networks
    const usedNetworks = serverNetworks.filter(
      (n) =>
        !presetNetworkIds.includes(n.id) && n.status === ENetworkStatus.LISTED,
    );

    await this.backgroundApi.simpleDb.serverNetwork.upsertServerNetworks({
      networkInfos: usedNetworks,
    });

    // delete custom networks
    const customNetworks = await this.getAllCustomNetworks();
    for (const customNetwork of customNetworks) {
      if (serverNetworks.find((n) => n.id === customNetwork.id)) {
        await this.deleteCustomNetwork({
          networkId: customNetwork.id,
          replaceByServerNetwork: true,
        });
      }
    }

    defaultLogger.account.wallet.insertServerNetwork(usedNetworks);
    return usedNetworks;
  }

  @backgroundMethod()
  async searchCustomNetworkByChainList(params: { chainId: string }) {
    try {
      const chainId = new BigNumber(params.chainId).toNumber();
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      const resp = await client.get<{ data: IChainListItem[] }>(
        '/wallet/v1/network/chainlist',
        {
          params: {
            keywords: chainId,
            showTestNet: true,
          },
        },
      );
      return (
        resp.data.data.find((n) =>
          new BigNumber(n.chainId).isEqualTo(new BigNumber(chainId)),
        ) || null
      );
    } catch {
      return null;
    }
  }
}

export default ServiceCustomRpc;
