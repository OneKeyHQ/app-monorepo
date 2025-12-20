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

  async getMarketWatchListV2() {
    const result: IMarketWatchListDataV2 | undefined | null =
      await this.getRawData();
    if (result) {
      return {
        data: result.data,
      };
    }
    return { data: [] };
  }

  async getMarketWatchListItemV2({
    chainId,
    contractAddress,
  }: {
    chainId: string;
    contractAddress: string;
  }): Promise<IMarketWatchListItemV2 | undefined> {
    try {
      const watchList = await this.getMarketWatchListV2();
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
        uniqByFn: (i) => `${i.chainId}:${i.contractAddress}`,
      });

      const newData: IMarketWatchListDataV2 | undefined | null = {
        data: newList,
      };
      return newData;
    });
  }

  async removeMarketWatchListV2({
    items,
    callerName,
  }: {
    items: Array<{ chainId: string; contractAddress: string }>;
    callerName: string;
  }) {
    defaultLogger.cloudSync.market.simpleDbRemoveWatchListItems({
      callerName,
      items,
    });
    await this.setRawData((data) => {
      const oldList = data?.data ?? [];

      // Fixed: Use equalTokenNoCaseSensitive from shared utils for proper token matching
      const filteredData = oldList.filter(
        (i) =>
          !items.some((item) =>
            equalTokenNoCaseSensitive({
              token1: {
                networkId: item.chainId,
                contractAddress: item.contractAddress,
              },
              token2: {
                networkId: i.chainId,
                contractAddress: i.contractAddress,
              },
            }),
          ),
      );

      const newData: IMarketWatchListDataV2 | undefined | null = {
        data: filteredData,
      };

      return newData;
    });
  }

  async clearAllMarketWatchListV2() {
    defaultLogger.cloudSync.market.simpleDbClearAllWatchListItems();
    await this.setRawData(() => {
      const newData: IMarketWatchListDataV2 = {
        data: [],
      };
      return newData;
    });
  }
}
