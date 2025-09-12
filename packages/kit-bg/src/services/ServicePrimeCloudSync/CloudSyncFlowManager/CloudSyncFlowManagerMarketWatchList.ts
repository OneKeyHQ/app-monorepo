import { cloneDeep } from 'lodash';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type { IMarketWatchListItem } from '@onekeyhq/shared/types/market';
import type {
  ICloudSyncPayloadMarketWatchList,
  ICloudSyncTargetMarketWatchList,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type { IDBCloudSyncItem, IDBDevice } from '../../../dbs/local/types';

export class CloudSyncFlowManagerMarketWatchList extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.MarketWatchList,
  IMarketWatchListItem
> {
  override dataType = EPrimeCloudSyncDataType.MarketWatchList as any;

  override removeSyncItemIfServerDeleted = true;

  override async buildSyncRawKey(params: {
    target: ICloudSyncTargetMarketWatchList;
  }): Promise<string> {
    return Promise.resolve(params.target.watchListItem.coingeckoId);
  }

  override async buildSyncPayload({
    target,
    _callerName,
  }: {
    target: ICloudSyncTargetMarketWatchList;
    _callerName?: string;
  }): Promise<ICloudSyncPayloadMarketWatchList> {
    const { watchListItem } = target;
    return Promise.resolve(cloneDeep(watchListItem));
  }

  override async isSupportSync(
    _target: ICloudSyncTargetMarketWatchList,
  ): Promise<boolean> {
    return true;
  }

  override async syncToSceneEachItem(params: {
    item: IDBCloudSyncItem;
    target: ICloudSyncTargetMarketWatchList;
    payload: ICloudSyncPayloadMarketWatchList;
  }): Promise<boolean> {
    const { payload, item } = params;

    const watchListItem: IMarketWatchListItem = {
      coingeckoId: payload.coingeckoId,
      sortIndex: payload.sortIndex,
    };
    if (item.isDeleted) {
      await this.backgroundApi.serviceMarket.removeMarketWatchList({
        watchList: [watchListItem],
        // avoid infinite loop sync
        skipSaveLocalSyncItem: true,
        skipEventEmit: true,
      });
    } else {
      await this.backgroundApi.serviceMarket.addMarketWatchList({
        watchList: [watchListItem],
        // avoid infinite loop sync
        skipSaveLocalSyncItem: true,
        skipEventEmit: true,
      });
    }
    return true;
  }

  override async getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadMarketWatchList;
  }): Promise<IMarketWatchListItem | undefined> {
    const { payload } = params;
    const watchList =
      await this.backgroundApi.serviceMarket.getMarketWatchList();
    const result = watchList.data.find(
      (i) => i.coingeckoId === payload.coingeckoId,
    );
    return cloneDeep(result);
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: IMarketWatchListItem;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetMarketWatchList> {
    return {
      targetId: params.dbRecord.coingeckoId,
      dataType: EPrimeCloudSyncDataType.MarketWatchList,
      watchListItem: cloneDeep(params.dbRecord),
    };
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadMarketWatchList;
  }): Promise<ICloudSyncTargetMarketWatchList | undefined> {
    const { payload } = params;
    return {
      targetId: payload.coingeckoId,
      dataType: EPrimeCloudSyncDataType.MarketWatchList,
      watchListItem: cloneDeep(payload),
    };
  }
}
