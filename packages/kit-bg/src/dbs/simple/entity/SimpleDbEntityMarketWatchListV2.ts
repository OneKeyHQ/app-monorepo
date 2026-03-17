import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
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
    return !!(item.perpsCoin || item.chainId?.trim());
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

  async getMarketWatchListItemV2({
    chainId,
    contractAddress,
    perpsCoin,
  }: {
    chainId: string;
    contractAddress: string;
    perpsCoin?: string;
  }): Promise<IMarketWatchListItemV2 | undefined> {
    try {
      const watchList = await this.getMarketWatchListV2();
      if (perpsCoin) {
        return watchList.data.find((item) => item.perpsCoin === perpsCoin);
      }
      return watchList.data.find((item) =>
        equalTokenNoCaseSensitive({
          token1: {
            networkId: chainId,
            contractAddress,
          },
          token2: {
            networkId: item.chainId,
            contractAddress: item.contractAddress,
          },
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
        uniqByFn: (i) =>
          i.perpsCoin
            ? `perps:${i.perpsCoin}`
            : `${i.chainId}:${i.contractAddress}`,
      });

      return { data: newList };
    });
  }

  async removeMarketWatchListV2({
    items,
    callerName,
  }: {
    items: Array<{
      chainId: string;
      contractAddress: string;
      perpsCoin?: string;
    }>;
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
            // Match spot items by chainId + contractAddress
            return equalTokenNoCaseSensitive({
              token1: {
                networkId: item.chainId,
                contractAddress: item.contractAddress,
              },
              token2: {
                networkId: i.chainId,
                contractAddress: i.contractAddress,
              },
            });
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
