import { cloneDeep } from 'lodash';

import type { IBrowserBookmark } from '@onekeyhq/kit/src/views/Discovery/types';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IBrowserBookmarks {
  data: IBrowserBookmark[];
}

export class SimpleDbEntityBrowserBookmarks extends SimpleDbEntityBase<IBrowserBookmarks> {
  entityName = 'browserBookmarks';

  override enableCache = false;

  async getBookmark({
    url,
  }: {
    url: string;
  }): Promise<IBrowserBookmark | undefined> {
    const rawData = await this.getRawData();
    return cloneDeep(rawData?.data.find((bookmark) => bookmark.url === url));
  }

  async saveBookmarks({
    bookmarks,
  }: {
    bookmarks: IBrowserBookmark[];
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const newList = sortUtils.buildSortedList({
        oldList: rawData?.data ?? [],
        saveItems: bookmarks,
        uniqByFn: (i) => i.url,
      });
      return {
        data: newList,
      };
    });
  }

  async removeBookmarks({ urls }: { urls: string[] }): Promise<void> {
    await this.setRawData((rawData) => {
      return {
        data:
          rawData?.data.filter((bookmark) => !urls.includes(bookmark.url)) ??
          [],
      };
    });
  }
}
