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

  // addOrEdit
  async addMarketWatchListV2({
    watchList,
  }: {
    watchList: IMarketWatchListItemV2[];
  }) {
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
  }: {
    items: Array<{ chainId: string; contractAddress: string }>;
  }) {
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
    await this.setRawData(() => {
      const newData: IMarketWatchListDataV2 = {
        data: [],
      };
      return newData;
    });
  }
}
