import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type {
  ICustomRpcItem,
  IDBCustomRpc,
  IMeasureRpcStatusParams,
} from '@onekeyhq/shared/types/customRpc';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

@backgroundClass()
class ServiceCustomRpc extends ServiceBase {
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
    const { chainId } = params;
    const networkId = accountUtils.buildCustomEvmNetworkId({
      chainId: chainId.toString(),
    });
    return this.backgroundApi.simpleDb.customNetwork.upsertCustomNetwork({
    });
  }
}

export default ServiceCustomRpc;
