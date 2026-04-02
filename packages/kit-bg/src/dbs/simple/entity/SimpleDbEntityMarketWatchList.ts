import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import type {
  IMarketWatchListData,
  IMarketWatchListItem,
} from '@onekeyhq/shared/types/market';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export class SimpleDbEntityMarketWatchList extends SimpleDbEntityBase<IMarketWatchListData> {
  entityName = 'marketWatchList';

  override enableCache = false;

  async getMarketWatchList() {
    const result: IMarketWatchListData | undefined | null =
      await this.getRawData();
    if (result) {
      return {
        data: result.data,
      };
    }
    return { data: [] };
  }

  // addOrEdit
  async addMarketWatchList({
    watchList,
  }: {
    watchList: IMarketWatchListItem[];
  }) {
    await this.setRawData((data) => {
      const oldList: IMarketWatchListItem[] = data?.data ?? [];

      const newList: IMarketWatchListItem[] = sortUtils.buildSortedList({
        oldList,
        saveItems: watchList,
        uniqByFn: (i) => i.coingeckoId,
      });

      const newData: IMarketWatchListData | undefined | null = {
        data: newList,
      };
      return newData;
    });
  }

  async removeMarketWatchList({ coingeckoIds }: { coingeckoIds: string[] }) {
    await this.setRawData((data) => {
      const newData: IMarketWatchListData | undefined | null = {
        data:
          data?.data.filter((i) => !coingeckoIds.includes(i.coingeckoId)) ?? [],
      };
      return newData;
    });
  }
}
