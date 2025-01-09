import { unionBy } from 'lodash';

import type { IBrowserBookmark } from '@onekeyhq/kit/src/views/Discovery/types';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { V4MigrationManagerBase } from './V4MigrationManagerBase';

import type { IV4ReduxBookmark } from './v4types/v4typesRedux';

export class V4MigrationForDiscover extends V4MigrationManagerBase {
  private async getV4BookmarkItems(): Promise<IV4ReduxBookmark[]> {
    const reduxData = await this.v4dbHubs.v4reduxDb.reduxData;
    if (!reduxData) {
      return [];
    }
    const bookmarks = reduxData.discover?.bookmarks;
    if (!bookmarks || bookmarks.length === 0) {
      return [];
    }
    return unionBy(bookmarks, (x) => x.url);
  }

  async convertV4DiscoverToV5() {
    const v4items = await this.getV4BookmarkItems();
    if (v4items.length === 0) {
      return;
    }
    let v5items: IBrowserBookmark[] = v4items.map((v4item) => ({
      title: v4item.title ?? uriUtils.getHostNameFromUrl({ url: v4item.url }),
      url: v4item.url,
    }));
    const currentV5Items =
      await this.backgroundApi.serviceDiscovery.getBrowserBookmarks();
    const urlSet = new Set(currentV5Items.map((x) => x.url));
    v5items = v5items.filter((x) => !urlSet.has(x.url));
    await this.backgroundApi.serviceDiscovery.setBrowserBookmarks([
      ...currentV5Items,
      ...v5items,
    ]);
  }
}
