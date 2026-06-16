import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import {
  equalTokenNoCaseSensitive,
  normalizeTokenContractAddress,
} from '@onekeyhq/shared/src/utils/tokenUtils';
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

  private _buildItemKey(item: IMarketWatchListItemV2): string {
    if (item.perpsCoin) {
      return `perps:${item.perpsCoin}`;
    }
    const contractAddress = item.isNative
      ? ''
      : (normalizeTokenContractAddress({
          networkId: item.chainId,
          contractAddress: item.contractAddress,
        }) ?? '');
    return `${item.chainId}:${contractAddress}`;
  }

  private _dedupeItems(
    items: IMarketWatchListItemV2[],
  ): IMarketWatchListItemV2[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = this._buildItemKey(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async getMarketWatchListV2() {
    const result = await this.getRawData();
    const data = result?.data ?? [];

    // Filter out invalid items (non-perps with empty chainId) on every read
    const validData = data.filter((item) => this._isValidItem(item));
    const cleanData = this._dedupeItems(validData);

    // Persist cleanup once per app session if invalid or duplicate items were found
    if (!this._watchListDataCleaned) {
      this._watchListDataCleaned = true;
      if (cleanData.length !== data.length) {
        void this.setRawData((rawData) => ({
          data: this._dedupeItems(
            (rawData?.data ?? []).filter((item) => this._isValidItem(item)),
          ),
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
        uniqByFn: (i) => this._buildItemKey(i),
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
