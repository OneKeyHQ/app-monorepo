import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  type IMarketWatchListItemRequiredIdentity,
  buildMarketWatchListItemKey,
  isSameMarketWatchListItem,
} from '@onekeyhq/shared/src/utils/marketWatchListUtils';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import type {
  IMarketWatchListDataV2,
  IMarketWatchListItemV2,
} from '@onekeyhq/shared/types/market';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export class SimpleDbEntityMarketWatchListV2 extends SimpleDbEntityBase<IMarketWatchListDataV2> {
  entityName = 'marketWatchListV2';

  override enableCache = false;

  private _watchListDataCleaned = false;

  private _isValidItem(item: IMarketWatchListItemV2): boolean {
    return !!(item.perpsCoin || item.chainId?.trim());
  }

  private _buildCleanData(items: IMarketWatchListItemV2[]): {
    cleanData: IMarketWatchListItemV2[];
    removedItems: IMarketWatchListItemV2[];
  } {
    const seen = new Set<string>();
    const cleanData: IMarketWatchListItemV2[] = [];
    const removedItems: IMarketWatchListItemV2[] = [];

    items.forEach((item) => {
      if (!this._isValidItem(item)) {
        removedItems.push(item);
        return;
      }

      const key = buildMarketWatchListItemKey(item);
      if (seen.has(key)) {
        removedItems.push(item);
        return;
      }
      seen.add(key);
      cleanData.push(item);
    });

    return { cleanData, removedItems };
  }

  markWatchListDataCleaned() {
    this._watchListDataCleaned = true;
  }

  async getMarketWatchListV2CleanupInfo() {
    const result = await this.getRawData();
    const data = result?.data ?? [];
    const { cleanData, removedItems } = this._buildCleanData(data);
    return {
      cleanData,
      removedItems,
      shouldCleanup: !this._watchListDataCleaned && removedItems.length > 0,
    };
  }

  async cleanupMarketWatchListV2Data() {
    await this.setRawData((rawData) => ({
      data: this._buildCleanData(rawData?.data ?? []).cleanData,
    }));
  }

  async getMarketWatchListV2() {
    const { cleanData } = await this.getMarketWatchListV2CleanupInfo();
    return { data: cleanData };
  }

  async getMarketWatchListItemV2({
    chainId,
    contractAddress,
    isNative,
    perpsCoin,
  }: IMarketWatchListItemRequiredIdentity): Promise<
    IMarketWatchListItemV2 | undefined
  > {
    try {
      const watchList = await this.getMarketWatchListV2();
      if (perpsCoin) {
        return watchList.data.find((item) => item.perpsCoin === perpsCoin);
      }
      return watchList.data.find((item) =>
        isSameMarketWatchListItem(item, {
          chainId,
          contractAddress,
          isNative,
        }),
      );
    } catch (error) {
      console.error('Failed to get market watch list item:', error);
      return undefined;
    }
  }

  // addOrEdit
  async addMarketWatchListV2({
    watchList,
    callerName,
  }: {
    watchList: IMarketWatchListItemV2[];
    callerName: string;
  }) {
    defaultLogger.cloudSync.market.simpleDbAddWatchListItems({
      callerName,
      items: watchList,
    });
    await this.setRawData((data) => {
      const oldList: IMarketWatchListItemV2[] = data?.data ?? [];

      const newList: IMarketWatchListItemV2[] = sortUtils.buildSortedList({
        oldList,
        saveItems: watchList,
        uniqByFn: (i) => buildMarketWatchListItemKey(i),
      });

      return { data: newList };
    });
  }

  async removeMarketWatchListV2({
    items,
    callerName,
  }: {
    items: IMarketWatchListItemRequiredIdentity[];
    callerName: string;
  }) {
    defaultLogger.cloudSync.market.simpleDbRemoveWatchListItems({
      callerName,
      items,
    });
    await this.setRawData((data) => {
      const oldList = data?.data ?? [];

      const filteredData = oldList.filter(
        (i) =>
          !items.some((item) => {
            // Match perps items by perpsCoin
            if (item.perpsCoin) {
              return i.perpsCoin === item.perpsCoin;
            }
            return isSameMarketWatchListItem(i, item);
          }),
      );

      return { data: filteredData };
    });
  }

  async clearAllMarketWatchListV2() {
    defaultLogger.cloudSync.market.simpleDbClearAllWatchListItems();
    await this.setRawData(() => ({ data: [] }));
  }
}
