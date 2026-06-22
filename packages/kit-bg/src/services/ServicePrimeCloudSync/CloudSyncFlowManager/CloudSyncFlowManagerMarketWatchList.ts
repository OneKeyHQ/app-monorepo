import { Semaphore } from 'async-mutex';
import { cloneDeep } from 'lodash';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  type IMarketWatchListItemIdentity,
  type IMarketWatchListItemRequiredIdentity,
  buildMarketWatchListItemKey,
  isSameMarketWatchListItem,
} from '@onekeyhq/shared/src/utils/marketWatchListUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type {
  ICloudSyncCredential,
  ICloudSyncPayloadMarketWatchList,
  ICloudSyncTargetMarketWatchList,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type { IDBCloudSyncItem, IDBDevice } from '../../../dbs/local/types';

function buildItemKey(item: IMarketWatchListItemIdentity) {
  return buildMarketWatchListItemKey(item, { delimiter: '_' });
}

function buildLegacyItemKey(item: IMarketWatchListItemIdentity) {
  return buildMarketWatchListItemKey(item, {
    delimiter: '_',
    normalizeNativeAddress: false,
  });
}

export class CloudSyncFlowManagerMarketWatchList extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.MarketWatchList,
  IMarketWatchListItemV2
> {
  override dataType = EPrimeCloudSyncDataType.MarketWatchList as any;

  override removeSyncItemIfServerDeleted = true;

  override async buildSyncRawKey(params: {
    target: ICloudSyncTargetMarketWatchList;
  }): Promise<string> {
    return Promise.resolve(buildItemKey(params.target.watchListItem));
  }

  async buildLegacySyncItemByDBQuery({
    dbRecord,
    isDeleted,
    dataTime,
    syncCredential,
  }: {
    dbRecord: IMarketWatchListItemRequiredIdentity;
    isDeleted: boolean | undefined;
    dataTime: number | undefined;
    syncCredential: ICloudSyncCredential | undefined;
  }) {
    return this.buildSyncItem({
      target: {
        targetId: buildLegacyItemKey(dbRecord),
        dataType: EPrimeCloudSyncDataType.MarketWatchList,
        watchListItem: dbRecord as IMarketWatchListItemV2,
      },
      dataTime,
      syncCredential,
      isDeleted,
    });
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

  syncToSceneMutex = new Semaphore(1);

  override async syncToSceneEachItem(params: {
    item: IDBCloudSyncItem;
    target: ICloudSyncTargetMarketWatchList;
    payload: ICloudSyncPayloadMarketWatchList;
  }): Promise<boolean> {
    return this.syncToSceneMutex.runExclusive(async () => {
      const { payload, item } = params;

      const isPerps = !!payload.perpsCoin;

      // Skip invalid non-perps items with empty chainId to avoid infinite sync retry
      if (!isPerps && !payload.chainId?.trim()) {
        return true;
      }

      const contractAddress = isPerps
        ? ''
        : normalizeTokenContractAddress({
            networkId: payload.chainId,
            contractAddress: payload.contractAddress,
          }) || '';

      const watchListItem: IMarketWatchListItemV2 = {
        chainId: payload.chainId,
        contractAddress,
        isNative: payload.isNative,
        sortIndex: payload.sortIndex,
        perpsCoin: payload.perpsCoin,
      };
      if (item.isDeleted) {
        defaultLogger.cloudSync.market.removeWatchList(watchListItem);
        await this.backgroundApi.serviceMarketV2.removeMarketWatchListV2({
          items: [
            isPerps
              ? {
                  chainId: '',
                  contractAddress: '',
                  perpsCoin: payload.perpsCoin,
                }
              : watchListItem,
          ],
          skipSaveLocalSyncItem: true,
          skipEventEmit: true,
          callerName: 'cloudSync_syncToSceneEachItem',
        });
        const removedItemExists =
          await this.backgroundApi.serviceMarketV2.getMarketWatchListItemV2({
            chainId: payload.chainId,
            contractAddress,
            isNative: payload.isNative,
            perpsCoin: payload.perpsCoin,
          });
        return !removedItemExists;
      }
      defaultLogger.cloudSync.market.addWatchList(watchListItem);
      await this.backgroundApi.serviceMarketV2.addMarketWatchListV2({
        watchList: [watchListItem],
        skipSaveLocalSyncItem: true,
        skipEventEmit: true,
        callerName: 'cloudSync_syncToSceneEachItem',
      });
      const addedItemExists =
        await this.backgroundApi.serviceMarketV2.getMarketWatchListItemV2({
          chainId: payload.chainId,
          contractAddress,
          isNative: payload.isNative,
          perpsCoin: payload.perpsCoin,
        });
      return !!addedItemExists;
    });
  }

  override async getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadMarketWatchList;
  }): Promise<IMarketWatchListItemV2 | undefined> {
    const { payload } = params;
    const watchList =
      await this.backgroundApi.serviceMarketV2.getMarketWatchListV2();
    const result = payload.perpsCoin
      ? watchList.data.find((i) => i.perpsCoin === payload.perpsCoin)
      : watchList.data.find((i) =>
          isSameMarketWatchListItem(i, {
            chainId: payload.chainId,
            contractAddress: payload.contractAddress,
            isNative: payload.isNative,
          }),
        );
    return cloneDeep(result);
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: IMarketWatchListItemV2;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetMarketWatchList> {
    return {
      targetId: buildItemKey(params.dbRecord),
      dataType: EPrimeCloudSyncDataType.MarketWatchList,
      watchListItem: cloneDeep(params.dbRecord),
    };
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadMarketWatchList;
  }): Promise<ICloudSyncTargetMarketWatchList | undefined> {
    const { payload } = params;
    return {
      targetId: buildItemKey(payload),
      dataType: EPrimeCloudSyncDataType.MarketWatchList,
      watchListItem: cloneDeep(payload),
    };
  }
}
