import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  getMarketWatchlistKey,
  isValidMarketWatchlistItem,
} from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import type {
  IMarketWatchListDataV2,
  IMarketWatchListItemV2,
} from '@onekeyhq/shared/types/market';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export class SimpleDbEntityMarketWatchListV2 extends SimpleDbEntityBase<IMarketWatchListDataV2> {
  entityName = 'marketWatchListV2';

  override enableCache = false;

  private _invalidItemsCleaned = false;

  private _isValidItem(item: IMarketWatchListItemV2): boolean {
    return isValidMarketWatchlistItem(item);
  }

  async getMarketWatchListV2() {
    const result = await this.getRawData();
    const data = result?.data ?? [];

    // Filter out invalid items (non-perps with empty chainId) on every read
    const cleanData = data.filter((item) => this._isValidItem(item));

    // Persist cleanup once per app session if invalid items were found
    if (!this._invalidItemsCleaned) {
      this._invalidItemsCleaned = true;
      if (cleanData.length !== data.length) {
        void this.setRawData((rawData) => ({
          data: (rawData?.data ?? []).filter((item) => this._isValidItem(item)),
        }));
      }
    }

    return { data: cleanData };
  }

  async getMarketWatchListItemV2(
    identity: IMarketWatchListItemV2,
  ): Promise<IMarketWatchListItemV2 | undefined> {
    const watchList = await this.getMarketWatchListV2();
    return watchList.data.find(
      (item) => getMarketWatchlistKey(item) === getMarketWatchlistKey(identity),
    );
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
        uniqByFn: getMarketWatchlistKey,
      });

      return { data: newList };
    });
  }

  async removeMarketWatchListV2({
    items,
    callerName,
  }: {
    items: IMarketWatchListItemV2[];
    callerName: string;
  }) {
    defaultLogger.cloudSync.market.simpleDbRemoveWatchListItems({
      callerName,
      items,
    });
    await this.setRawData((data) => {
      const oldList = data?.data ?? [];

      const filteredData = oldList.filter(
        (item) =>
          !items.some(
            (removed) =>
              getMarketWatchlistKey(item) === getMarketWatchlistKey(removed),
          ),
      );

      return { data: filteredData };
    });
  }

  async clearAllMarketWatchListV2() {
    defaultLogger.cloudSync.market.simpleDbClearAllWatchListItems();
    await this.setRawData(() => ({ data: [] }));
  }
}
