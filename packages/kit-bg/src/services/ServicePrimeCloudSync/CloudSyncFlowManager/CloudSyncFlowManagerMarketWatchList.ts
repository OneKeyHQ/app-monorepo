import { Semaphore } from 'async-mutex';
import { cloneDeep } from 'lodash';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  equalTokenNoCaseSensitive,
  normalizeTokenContractAddress,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type {
  ICloudSyncPayloadMarketWatchList,
  ICloudSyncTargetMarketWatchList,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type { IDBCloudSyncItem, IDBDevice } from '../../../dbs/local/types';

function buildItemKey(item: IMarketWatchListItemV2) {
  if (item.perpsCoin) {
    return `perps_${item.perpsCoin}`;
  }
  return [
    item.chainId,
    normalizeTokenContractAddress({
      networkId: item.chainId,
      contractAddress: item.contractAddress,
    }) || '',
  ].join('_');
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
          equalTokenNoCaseSensitive({
            token1: {
              networkId: i.chainId,
              contractAddress: i.contractAddress,
            },
            token2: {
              networkId: payload.chainId,
              contractAddress: payload.contractAddress,
            },
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
