import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  ICloudSyncCredential,
  ICloudSyncCredentialForLock,
  ICloudSyncPayloadLock,
  ICloudSyncTargetLock,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type { IDBDevice } from '../../../dbs/local/types';

export class CloudSyncFlowManagerLock extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.Lock,
  any
> {
  override dataType = EPrimeCloudSyncDataType.Lock as const;

  override removeSyncItemIfServerDeleted = true;

  getLockStaticSyncCredential(
    syncCredential: ICloudSyncCredential,
  ): ICloudSyncCredentialForLock {
    if (!syncCredential) {
      throw new OneKeyLocalError(
        'syncCredential is required for build flush lock',
      );
    }
    return {
      primeAccountSalt: syncCredential.primeAccountSalt,
      masterPasswordUUID: syncCredential.masterPasswordUUID,
      securityPasswordR1: 'lock', // use static securityPasswordR1 for lock
    };
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadLock;
  }): Promise<ICloudSyncTargetLock | undefined> {
    return {
      targetId: 'lock',
      dataType: EPrimeCloudSyncDataType.Lock,
      encryptedSecurityPasswordR1ForServer:
        params.payload.encryptedSecurityPasswordR1ForServer,
    };
  }

  override async isSupportSync(
    _target: ICloudSyncTargetLock,
  ): Promise<boolean> {
    return true;
  }

  override async buildSyncRawKey(_params: {
    target: ICloudSyncTargetLock;
  }): Promise<string> {
    return 'lock';
  }

  override async buildSyncPayload({
    target,
  }: {
    target: ICloudSyncTargetLock;
  }): Promise<ICloudSyncPayloadLock> {
    return {
      message: 'lock',
      encryptedSecurityPasswordR1ForServer:
        target.encryptedSecurityPasswordR1ForServer,
    };
  }

  override async syncToSceneEachItem(_params: {
    target: ICloudSyncTargetLock;
    payload: ICloudSyncPayloadLock;
  }): Promise<boolean> {
    // do nothing
    return true;
  }

  override async getDBRecordBySyncPayload(_params: {
    payload: ICloudSyncPayloadLock;
  }): Promise<any | undefined> {
    return undefined;
  }

  override async buildSyncTargetByDBQuery(_params: {
    dbRecord: any;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetLock> {
    return undefined as unknown as ICloudSyncTargetLock;
  }
}
