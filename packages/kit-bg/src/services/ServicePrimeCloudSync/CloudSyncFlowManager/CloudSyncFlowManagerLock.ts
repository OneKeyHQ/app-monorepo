import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  ICloudSyncKeyInfoLock,
  ICloudSyncPayloadLock,
  ICloudSyncTargetLock,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type { IDBDevice } from '../../../dbs/local/types';

export class CloudSyncFlowManagerLock extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.Lock,
  any
> {
  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadLock;
  }): Promise<ICloudSyncTargetLock | undefined> {
    return this.staticSyncTarget;
  }

  override dataType = EPrimeCloudSyncDataType.Lock as const;

  override async isSupportSync(target: ICloudSyncTargetLock): Promise<boolean> {
    return true;
  }

  override async buildSyncRawKey({
    target,
  }: {
    target: ICloudSyncTargetLock;
  }): Promise<string> {
    return 'lock';
  }

  override async buildSyncPayload({
    target,
  }: {
    target: ICloudSyncTargetLock;
  }): Promise<ICloudSyncPayloadLock> {
    return this.staticSyncPayload;
  }

  override async syncToSceneEachItem(params: {
    target: ICloudSyncTargetLock;
    payload: ICloudSyncPayloadLock;
  }): Promise<void> {
    // do nothing
  }

  override async getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadLock;
  }): Promise<any | undefined> {
    return undefined;
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: any;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetLock> {
    return this.staticSyncTarget;
  }

  get staticSyncTarget(): ICloudSyncTargetLock {
    return {
      targetId: 'lock',
      dataType: EPrimeCloudSyncDataType.Lock,
    };
  }

  get staticSyncPayload(): ICloudSyncPayloadLock {
    return {
      message: 'lock',
    };
  }
}
