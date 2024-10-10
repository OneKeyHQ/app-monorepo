import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  getNetworkIds,
  getNetworkIdsMap,
} from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { ENetworkStatus, type IServerNetwork } from '@onekeyhq/shared/types';
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
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  public isLoading: boolean | undefined;

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
  public async getAllCustomRpc(): Promise<ICustomRpcItem[]> {
    const result =
      await this.backgroundApi.simpleDb.customRpc.getAllCustomRpc();
    return Promise.all(
      result.map(async (r) => ({
        ...r,
        network: await this.backgroundApi.serviceNetwork.getNetwork({
          networkId: r.networkId,
        }),
      })),
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
  public async deleteCustomNetwork(params: { networkId: string }) {
    await this.deleteCustomRpc(params.networkId);
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
  public async fetchNetworkFromServer(): Promise<IServerNetwork[]> {
    if (this.isLoading) {
      return [];
    }
    this.isLoading = true;
    console.log('====$$$$%%%%%%%%===>>: fetchNetworkFromServer');
    // 请求 /wallet/v1/network/list 接口获取全部 evm 的网络列表
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
    serverNetworks.push(...this.mockServerNetwork());
    const presetNetworkIds = Object.values(getNetworkIdsMap());
    // filter preset networks
    const usedNetworks = serverNetworks.filter(
      (n) => !presetNetworkIds.includes(n.id),
    );

    // delete custom networks
    const customNetworks = await this.getAllCustomNetworks();
    for (const customNetwork of customNetworks) {
      if (serverNetworks.find((n) => n.id === customNetwork.id)) {
        await this.deleteCustomNetwork({ networkId: customNetwork.id });
      }
    }

    console.log('=====>>>: usedNetworks: ', usedNetworks);
    return usedNetworks;
  }

  private mockServerNetwork(): IServerNetwork[] {
    return [
      {
        'impl': 'evm',
        'chainId': '32769',
        'id': 'evm--32769',
        'name': 'Zilliqa EVM',
        'symbol': 'ETH',
        'code': 'zilliqa',
        'shortcode': 'zilliqa',
        'shortname': 'Zilliqa',
        'decimals': 18,
        'feeMeta': {
          'code': 'eth',
          'decimals': 9,
          'symbol': 'Gwei',
          'isEIP1559FeeEnabled': false,
          'isWithL1BaseFee': false,
        },
        'status': ENetworkStatus.LISTED,
        'isTestnet': true,
        'logoURI': '',
        'defaultEnabled': false,
        'backendIndex': false,
      },
      {
        'impl': 'evm',
        'chainId': '245022934',
        'id': 'evm--245022934',
        'name': 'Neon EVM Mainnet',
        'symbol': 'ETH',
        'code': 'neon',
        'shortcode': 'neon',
        'shortname': 'neon',
        'decimals': 18,
        'feeMeta': {
          'code': 'eth',
          'decimals': 9,
          'symbol': 'Gwei',
          'isEIP1559FeeEnabled': false,
          'isWithL1BaseFee': false,
        },
        'status': ENetworkStatus.LISTED,
        'isTestnet': true,
        'logoURI': '',
        'defaultEnabled': false,
        'backendIndex': false,
      },
    ];
  }
}

export default ServiceCustomRpc;
