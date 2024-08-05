import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  ICustomRpcItem,
  IDBCustomRpc,
  IMeasureRpcStatusParams,
} from '@onekeyhq/shared/types/customRpc';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceCustomRpc extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

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
}

export default ServiceCustomRpc;
