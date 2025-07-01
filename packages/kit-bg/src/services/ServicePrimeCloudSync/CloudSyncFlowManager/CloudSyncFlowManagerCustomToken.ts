import { cloneDeep } from 'lodash';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { NATIVE_TOKEN_MOCK_ADDRESS } from '@onekeyhq/shared/src/consts/tokenConsts';
import type {
  ICloudSyncPayloadCustomToken,
  ICloudSyncTargetCustomToken,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import {
  ECustomTokenStatus,
  type ICloudSyncCustomToken,
} from '@onekeyhq/shared/types/token';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type { IDBCloudSyncItem, IDBDevice } from '../../../dbs/local/types';

export class CloudSyncFlowManagerCustomToken extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.CustomToken,
  ICloudSyncCustomToken
> {
  override dataType = EPrimeCloudSyncDataType.CustomToken as any;

  override removeSyncItemIfServerDeleted = true;

  override async buildSyncRawKey(params: {
    target: ICloudSyncTargetCustomToken;
  }): Promise<string> {
    const { customToken } = params.target;
    let tokenAddress = customToken.address;
    if (!tokenAddress && customToken.isNative) {
      tokenAddress = NATIVE_TOKEN_MOCK_ADDRESS;
    }
    const rawKey = [
      customToken.networkId,
      `token:${tokenAddress}`,
      `account:${customToken.accountXpubOrAddress}`,
    ].join('__');
    return Promise.resolve(rawKey);
  }

  override async buildSyncPayload({
    target,
    _callerName,
  }: {
    target: ICloudSyncTargetCustomToken;
    _callerName?: string;
  }): Promise<ICloudSyncPayloadCustomToken> {
    const { customToken } = target;
    return Promise.resolve({
      customToken: cloneDeep(customToken),
    });
  }

  override async isSupportSync(
    target: ICloudSyncTargetCustomToken,
  ): Promise<boolean> {
    const { customToken } = target;
    return !!(
      customToken.networkId &&
      (customToken.address || customToken.isNative) &&
      customToken.accountXpubOrAddress
    );
  }

  override async syncToSceneEachItem(params: {
    item: IDBCloudSyncItem;
    target: ICloudSyncTargetCustomToken;
    payload: ICloudSyncPayloadCustomToken;
  }): Promise<boolean> {
    const { payload, item } = params;

    const { customToken } = cloneDeep(payload);
    if (item.isDeleted) {
      //  do nothing
    } else {
      if (customToken.tokenStatus === ECustomTokenStatus.Custom) {
        await this.backgroundApi.serviceCustomToken.addCustomToken({
          token: customToken,
          // avoid infinite loop sync
          skipSaveLocalSyncItem: true,
          skipEventEmit: true,
        });
      }
      if (customToken.tokenStatus === ECustomTokenStatus.Hidden) {
        await this.backgroundApi.serviceCustomToken.hideToken({
          token: customToken,
          // avoid infinite loop sync
          skipSaveLocalSyncItem: true,
          skipEventEmit: true,
        });
      }
    }
    return true;
  }

  override async getDBRecordBySyncPayload(_params: {
    payload: ICloudSyncPayloadCustomToken;
  }): Promise<ICloudSyncCustomToken | undefined> {
    return undefined;
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: ICloudSyncCustomToken;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetCustomToken> {
    // const accountXpubOrAddress =
    //   await this.backgroundApi.serviceAccount.getAccountXpubOrAddress({
    //     networkId,
    //     accountId,
    //   });

    return {
      targetId: ``,
      dataType: EPrimeCloudSyncDataType.CustomToken,
      customToken: cloneDeep(params.dbRecord),
    };
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadCustomToken;
  }): Promise<ICloudSyncTargetCustomToken | undefined> {
    const { payload } = params;
    const { customToken } = payload;
    return {
      targetId: ``,
      dataType: EPrimeCloudSyncDataType.CustomToken,
      customToken: cloneDeep(customToken),
    };
  }
}
