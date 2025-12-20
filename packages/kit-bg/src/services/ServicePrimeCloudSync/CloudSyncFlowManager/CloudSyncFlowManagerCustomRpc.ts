import { cloneDeep } from 'lodash';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type { IDBCustomRpc } from '@onekeyhq/shared/types/customRpc';
import type {
  ICloudSyncPayloadCustomRpc,
  ICloudSyncTargetCustomRpc,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type { IDBCloudSyncItem, IDBDevice } from '../../../dbs/local/types';

export class CloudSyncFlowManagerCustomRpc extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.CustomRpc,
  IDBCustomRpc
> {
  override dataType = EPrimeCloudSyncDataType.CustomRpc as any;

  override removeSyncItemIfServerDeleted = true;

  override async buildSyncRawKey(params: {
    target: ICloudSyncTargetCustomRpc;
  }): Promise<string> {
    return Promise.resolve(params.target.customRpc.networkId);
  }

  override async buildSyncPayload({
    target,
    _callerName,
  }: {
    target: ICloudSyncTargetCustomRpc;
    _callerName?: string;
  }): Promise<ICloudSyncPayloadCustomRpc> {
    const { customRpc } = target;
    return Promise.resolve(cloneDeep(customRpc));
  }

  override async isSupportSync(
    _target: ICloudSyncTargetCustomRpc,
  ): Promise<boolean> {
    return true;
  }

  override async syncToSceneEachItem(params: {
    item: IDBCloudSyncItem;
    target: ICloudSyncTargetCustomRpc;
    payload: ICloudSyncPayloadCustomRpc;
  }): Promise<boolean> {
    const { payload, item } = params;

    const customRpc: IDBCustomRpc = {
      networkId: payload.networkId,
      rpc: payload.rpc,
      enabled: payload.enabled,
      isCustomNetwork: payload.isCustomNetwork,
      updatedAt: payload.updatedAt,
    };
    if (item.isDeleted) {
      await this.backgroundApi.serviceCustomRpc.deleteCustomRpc({
        customRpc,
        // avoid infinite loop sync
        skipSaveLocalSyncItem: true,
        skipEventEmit: true,
      });
    } else {
      await this.backgroundApi.serviceCustomRpc.addCustomRpc({
        customRpc,
        // avoid infinite loop sync
        skipSaveLocalSyncItem: true,
        skipEventEmit: true,
      });
    }
    return true;
  }

  override async getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadCustomRpc;
  }): Promise<IDBCustomRpc | undefined> {
    const { payload } = params;
    const customRpc =
      await this.backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(
        payload.networkId,
      );
    return cloneDeep(customRpc);
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: IDBCustomRpc;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetCustomRpc> {
    return {
      targetId: params.dbRecord.networkId,
      dataType: EPrimeCloudSyncDataType.CustomRpc,
      customRpc: cloneDeep(params.dbRecord),
    };
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadCustomRpc;
  }): Promise<ICloudSyncTargetCustomRpc | undefined> {
    const { payload } = params;
    return {
      targetId: payload.networkId,
      dataType: EPrimeCloudSyncDataType.CustomRpc,
      customRpc: cloneDeep(payload),
    };
  }
}
