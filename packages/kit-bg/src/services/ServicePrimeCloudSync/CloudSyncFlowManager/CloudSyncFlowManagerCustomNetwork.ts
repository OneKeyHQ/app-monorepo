import { cloneDeep } from 'lodash';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IDBCustomRpc } from '@onekeyhq/shared/types/customRpc';
import type {
  ICloudSyncPayloadCustomNetwork,
  ICloudSyncTargetCustomNetwork,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type { IDBCloudSyncItem, IDBDevice } from '../../../dbs/local/types';

export class CloudSyncFlowManagerCustomNetwork extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.CustomNetwork,
  IServerNetwork
> {
  override dataType = EPrimeCloudSyncDataType.CustomNetwork as any;

  override removeSyncItemIfServerDeleted = true;

  override async buildSyncRawKey(params: {
    target: ICloudSyncTargetCustomNetwork;
  }): Promise<string> {
    return Promise.resolve(params.target.customNetwork.id);
  }

  override async buildSyncPayload({
    target,
    _callerName,
  }: {
    target: ICloudSyncTargetCustomNetwork;
    _callerName?: string;
  }): Promise<ICloudSyncPayloadCustomNetwork> {
    const { customNetwork, customRpc } = target;
    return Promise.resolve(
      cloneDeep({
        customNetwork,
        customRpc,
      }),
    );
  }

  override async isSupportSync(
    _target: ICloudSyncTargetCustomNetwork,
  ): Promise<boolean> {
    return true;
  }

  override async syncToSceneEachItem(params: {
    item: IDBCloudSyncItem;
    target: ICloudSyncTargetCustomNetwork;
    payload: ICloudSyncPayloadCustomNetwork;
  }): Promise<boolean> {
    const { payload, item } = params;

    const networkInfo: IServerNetwork = payload.customNetwork;
    let rpcInfo: IDBCustomRpc | undefined = payload.customRpc;
    if (item.isDeleted) {
      await this.backgroundApi.serviceCustomRpc.deleteCustomNetwork({
        networkId: networkInfo.id,
        replaceByServerNetwork: false,
        // avoid infinite loop sync
        skipSaveLocalSyncItem: true,
        skipEventEmit: true,
      });
    } else {
      let rpcUrl = rpcInfo?.rpc;
      if (!rpcUrl) {
        rpcInfo =
          await this.backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(
            networkInfo.id,
          );
        rpcUrl = rpcInfo?.rpc || '';
      }
      if (rpcUrl) {
        await this.backgroundApi.serviceCustomRpc.upsertCustomNetworkInfo({
          networkInfo,
          rpcUrl,
          // avoid infinite loop sync
          skipSaveLocalSyncItem: true,
          skipEventEmit: true,
        });
      }
    }
    return true;
  }

  override async getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadCustomNetwork;
  }): Promise<IServerNetwork | undefined> {
    const { payload } = params;
    const customNetworks =
      await this.backgroundApi.serviceCustomRpc.getAllCustomNetworks();
    const result = customNetworks.find(
      (n) => n.id === payload.customNetwork.id,
    );
    return cloneDeep(result);
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: IServerNetwork;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetCustomNetwork> {
    const customNetwork: IServerNetwork = params.dbRecord;
    const customRpc =
      await this.backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(
        customNetwork.id,
      );
    return {
      targetId: customNetwork.id,
      dataType: EPrimeCloudSyncDataType.CustomNetwork,
      customNetwork: cloneDeep(customNetwork),
      customRpc: cloneDeep(customRpc || ({} as any)),
    };
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadCustomNetwork;
  }): Promise<ICloudSyncTargetCustomNetwork | undefined> {
    const { customNetwork, customRpc } = params.payload;
    return {
      targetId: customNetwork.id,
      dataType: EPrimeCloudSyncDataType.CustomNetwork,
      customNetwork: cloneDeep(customNetwork),
      customRpc: cloneDeep(customRpc),
    };
  }
}
