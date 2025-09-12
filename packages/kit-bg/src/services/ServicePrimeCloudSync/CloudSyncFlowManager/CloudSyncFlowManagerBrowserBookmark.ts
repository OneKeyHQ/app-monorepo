import { cloneDeep } from 'lodash';

import type { IBrowserBookmark } from '@onekeyhq/kit/src/views/Discovery/types';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type {
  ICloudSyncPayloadBrowserBookmark,
  ICloudSyncTargetBrowserBookmark,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import simpleDb from '../../../dbs/simple/simpleDb';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type { IDBCloudSyncItem, IDBDevice } from '../../../dbs/local/types';

export class CloudSyncFlowManagerBrowserBookmark extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.BrowserBookmark,
  IBrowserBookmark
> {
  override dataType = EPrimeCloudSyncDataType.BrowserBookmark as any;

  override removeSyncItemIfServerDeleted = true;

  override async buildSyncRawKey(params: {
    target: ICloudSyncTargetBrowserBookmark;
  }): Promise<string> {
    return Promise.resolve(params.target.bookmark.url);
  }

  override async buildSyncPayload({
    target,
    _callerName,
  }: {
    target: ICloudSyncTargetBrowserBookmark;
    _callerName?: string;
  }): Promise<ICloudSyncPayloadBrowserBookmark> {
    const { bookmark } = target;
    return Promise.resolve(cloneDeep(bookmark));
  }

  override async isSupportSync(
    _target: ICloudSyncTargetBrowserBookmark,
  ): Promise<boolean> {
    return true;
  }

  override async syncToSceneEachItem(params: {
    item: IDBCloudSyncItem;
    target: ICloudSyncTargetBrowserBookmark;
    payload: ICloudSyncPayloadBrowserBookmark;
  }): Promise<boolean> {
    const { payload, item } = params;
    const bookmark: IBrowserBookmark = {
      title: payload.title,
      url: payload.url,
      logo: payload.logo ?? undefined,
      sortIndex: payload.sortIndex,
    };
    // TODO remove bookmarks
    await this.backgroundApi.serviceDiscovery.setBrowserBookmarks({
      isRemove: item.isDeleted,
      bookmarks: [bookmark],
      // avoid infinite loop sync
      skipSaveLocalSyncItem: true,
      skipEventEmit: true,
    });
    return true;
  }

  override async getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadBrowserBookmark;
  }): Promise<IBrowserBookmark | undefined> {
    const { payload } = params;
    const bookmark = await simpleDb.browserBookmarks.getBookmark({
      url: payload.url,
    });
    return cloneDeep(bookmark);
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: IBrowserBookmark;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetBrowserBookmark> {
    return {
      targetId: params.dbRecord.url,
      dataType: EPrimeCloudSyncDataType.BrowserBookmark,
      bookmark: cloneDeep(params.dbRecord),
    };
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadBrowserBookmark;
  }): Promise<ICloudSyncTargetBrowserBookmark | undefined> {
    return {
      targetId: params.payload.url,
      dataType: EPrimeCloudSyncDataType.BrowserBookmark,
      bookmark: cloneDeep(params.payload),
    };
  }
}
