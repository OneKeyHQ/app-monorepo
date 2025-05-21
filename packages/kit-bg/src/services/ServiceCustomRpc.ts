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

import { type IDBCloudSyncItem } from '../dbs/local/types';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceCustomRpc extends ServiceBase {
  private semaphore = new Semaphore(1);

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  async buildCustomRpcSyncItems({
    customRpcItems,
    isDeleted,
  }: {
    customRpcItems: IDBCustomRpc[];
    isDeleted: boolean;
  }) {
    const syncManagers = this.backgroundApi.servicePrimeCloudSync.syncManagers;
    const now = await this.backgroundApi.servicePrimeCloudSync.timeNow();
    const syncCredential =
      await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();

    const syncItems = (
      await Promise.all(
        customRpcItems.map(async (customRpc) => {
          return syncManagers.customRpc.buildSyncItemByDBQuery({
            syncCredential,
            dbRecord: customRpc,
            dataTime: now,
            isDeleted,
          });
        }),
      )
    ).filter(Boolean);
    return syncItems;
  }

  async buildCustomNetworkSyncItems({
    customNetworks,
    isDeleted,
  }: {
    customNetworks: IServerNetwork[];
    isDeleted: boolean;
  }) {
    const syncManagers = this.backgroundApi.servicePrimeCloudSync.syncManagers;
    const now = await this.backgroundApi.servicePrimeCloudSync.timeNow();
    const syncCredential =
      await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();

    const syncItems = (
      await Promise.all(
        customNetworks.map(async (customNetwork) => {
          return syncManagers.customNetwork.buildSyncItemByDBQuery({
            syncCredential,
            dbRecord: customNetwork,
            dataTime: now,
            isDeleted,
          });
        }),
      )
    ).filter(Boolean);
    return syncItems;
  }

  // TODO move to CloudSyncFlowManagerBase
  async withCustomRpcCloudSync({
    fn,
    customRpcItems,
    isDeleted,
    skipSaveLocalSyncItem,
  }: // skipEventEmit,
  {
    fn: () => Promise<void>;
    customRpcItems: IDBCustomRpc[];
    isDeleted: boolean;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    let syncItems: IDBCloudSyncItem[] = [];
    if (!skipSaveLocalSyncItem) {
      syncItems = await this.buildCustomRpcSyncItems({
        customRpcItems,
        isDeleted,
      });
    }
    await this.backgroundApi.localDb.addAndUpdateSyncItems({
      items: syncItems,
      fn,
    });
  }

  async withCustomNetworkCloudSync({
    fn,
    customNetworks,
    isDeleted,
    skipSaveLocalSyncItem,
  }: // skipEventEmit,
  {
    fn: () => Promise<void>;
    customNetworks: IServerNetwork[];
    isDeleted: boolean;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    let syncItems: IDBCloudSyncItem[] = [];
    if (!skipSaveLocalSyncItem) {
      syncItems = await this.buildCustomNetworkSyncItems({
        customNetworks,
        isDeleted,
      });
    }
    await this.backgroundApi.localDb.addAndUpdateSyncItems({
      items: syncItems,
      fn,
    });
  }

  /*= ===============================
   *       Custom RPC
   *============================== */

  @backgroundMethod()
  public async addCustomRpc({
    customRpc,
    skipSaveLocalSyncItem,
    skipEventEmit,
  }: {
    customRpc: IDBCustomRpc;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    return this.withCustomRpcCloudSync({
      fn: () =>
        this.backgroundApi.simpleDb.customRpc.addCustomRpc({
          rpcInfo: customRpc,
        }),
      customRpcItems: [customRpc],
      isDeleted: false,
      skipSaveLocalSyncItem,
      skipEventEmit,
    });
  }

  @backgroundMethod()
  public async deleteCustomRpc({
    customRpc,
    skipSaveLocalSyncItem,
    skipEventEmit,
  }: {
    customRpc: IDBCustomRpc;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    return this.withCustomRpcCloudSync({
      fn: () =>
        this.backgroundApi.simpleDb.customRpc.deleteCustomRpc(
          customRpc.networkId,
        ),
      customRpcItems: [customRpc],
      isDeleted: true,
      skipSaveLocalSyncItem,
      skipEventEmit,
    });
  }

  @backgroundMethod()
  public async updateCustomRpcEnabledStatus(params: {
    networkId: string;
    enabled: boolean;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    const { networkId, enabled, skipSaveLocalSyncItem, skipEventEmit } = params;
    const customRpc = await this.getCustomRpcForNetwork(networkId);
    if (!customRpc) {
      return;
    }
    return this.withCustomRpcCloudSync({
      fn: () =>
        this.backgroundApi.simpleDb.customRpc.updateCustomRpcEnabledStatus(
          params,
        ),
      customRpcItems: [{ ...customRpc, enabled }],
      isDeleted: false,
      skipSaveLocalSyncItem,
      skipEventEmit,
    });
  }

  @backgroundMethod()
  public async getAllCustomRpc(): Promise<ICustomRpcItem[]> {
    const result =
      await this.backgroundApi.simpleDb.customRpc.getAllCustomRpc();
    const itemsWithNetwork = (
      await Promise.all(
        result.map(async (r) => {
          const network =
            await this.backgroundApi.serviceNetwork.getNetworkSafe({
              networkId: r.networkId,
            });
          if (!network) {
            return null;
          }
          return {
            ...r,
            network,
          };
        }),
      )
    ).filter(Boolean);
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

  async upsertCustomNetworkInfo({
    networkInfo,
    rpcUrl,
    skipSaveLocalSyncItem,
    skipEventEmit,
  }: {
    networkInfo: IServerNetwork;
    rpcUrl: string;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    const networkId = networkInfo.id;

    // Insert custom rpc
    await this.addCustomRpc({
      customRpc: {
        networkId,
        enabled: true,
        rpc: rpcUrl,
        isCustomNetwork: true,
        updatedAt: undefined,
      },
      skipSaveLocalSyncItem,
      skipEventEmit,
    });

    await this.withCustomNetworkCloudSync({
      fn: async () => {
        // Insert native token
        const nativeToken: IToken = {
          decimals: 18,
          name: networkInfo.symbol,
          symbol: networkInfo.symbol,
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

        void this.backgroundApi.serviceNetwork.clearAllNetworksCache();
        setTimeout(() => {
          void this.backgroundApi.serviceNetwork.clearNetworkVaultSettingsCache();
          if (!skipEventEmit) {
            appEventBus.emit(EAppEventBusNames.AddedCustomNetwork, undefined);
          }
        }, 500);
      },
      customNetworks: [networkInfo],
      isDeleted: false,
      skipSaveLocalSyncItem,
      skipEventEmit,
    });
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

    return this.upsertCustomNetworkInfo({
      networkInfo,
      rpcUrl: params.rpcUrl,
    });
  }

  @backgroundMethod()
  public async deleteCustomNetwork(params: {
    networkId: string;
    replaceByServerNetwork?: boolean;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    const { skipEventEmit, skipSaveLocalSyncItem } = params;
    if (params.replaceByServerNetwork) {
      await this.updateCustomRpcEnabledStatus({
        networkId: params.networkId,
        enabled: false,
        skipEventEmit,
        skipSaveLocalSyncItem,
      });
    } else {
      const customRpc = await this.getCustomRpcForNetwork(params.networkId);
      if (customRpc) {
        await this.deleteCustomRpc({
          customRpc,
          skipEventEmit,
          skipSaveLocalSyncItem,
        });
      }
    }

    const allCustomNetwork = await this.getAllCustomNetworks();
    const customNetwork = allCustomNetwork.find(
      (n) => n.id === params.networkId,
    );
    if (customNetwork) {
      await this.withCustomNetworkCloudSync({
        fn: async () => {
          await this.backgroundApi.simpleDb.customNetwork.deleteCustomNetwork(
            params,
          );
          void this.backgroundApi.serviceNetwork.clearAllNetworksCache();
          setTimeout(() => {
            if (!skipEventEmit) {
              appEventBus.emit(EAppEventBusNames.AddedCustomNetwork, undefined);
            }
          }, 300);
        },
        customNetworks: [customNetwork],
        isDeleted: true,
        skipSaveLocalSyncItem,
        skipEventEmit,
      });
    }
  }

  @backgroundMethod()
  public async getAllCustomNetworks(): Promise<IServerNetwork[]> {
    try {
      return await this.backgroundApi.simpleDb.customNetwork.getAllCustomNetworks();
    } catch {
      return [];
    }
  }

  /*= ===============================
   *       Server Network
   *============================== */
  @backgroundMethod()
  public async getServerNetworks(): Promise<IServerNetwork[]> {
    return this.semaphore.runExclusive(async () => {
      try {
        const { networks, lastFetchTime } =
          await this.backgroundApi.simpleDb.serverNetwork.getAllServerNetworks();
        const now = Date.now();

        if (
          !lastFetchTime ||
          now - lastFetchTime >= timerUtils.getTimeDurationMs({ hour: 1 })
        ) {
          void this.fetchNetworkFromServer().catch((error) => {
            defaultLogger.account.wallet.getServerNetworksError(error);
          });
        }
        defaultLogger.account.wallet.getServerNetworks(networks);
        return networks || [];
      } catch (error) {
        defaultLogger.account.wallet.getServerNetworksError(error);
        return [];
      }
    });
  }

  @backgroundMethod()
  public async fetchNetworkFromServer(): Promise<IServerNetwork[]> {
    // await timerUtils.wait(3000 * 10);
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

    // If the server network is updated, clear the getAllNetworks cache
    await this.backgroundApi.serviceNetwork.clearAllNetworksCache();

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
