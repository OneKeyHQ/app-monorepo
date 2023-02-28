/* eslint-disable @typescript-eslint/require-await */

import uuid from 'react-native-uuid';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import {
  addBookmark,
  cleanOldState,
  clearHistory,
  removeBookmark,
  removeDappHistory,
  removeUserBrowserHistory,
  removeWebSiteHistory,
  resetBookmarks,
  setDappHistory,
  setFavoritesMigrated,
  setHomeData,
  updateBookmark,
} from '@onekeyhq/kit/src/store/reducers/discover';
import { setWebTabData } from '@onekeyhq/kit/src/store/reducers/webTabs';
import type { MatchDAppItemType } from '@onekeyhq/kit/src/views/Discover/Explorer/explorerUtils';
import type {
  BookmarkItem,
  DAppItemType,
  TagDappsType,
  UrlInfo,
} from '@onekeyhq/kit/src/views/Discover/type';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServicDiscover extends ServiceBase {
  updatedAt = 0;

  get baseUrl() {
    const url = getFiatEndpoint();
    return `${url}/discover`;
  }

  init() {
    this.migrateFavorite();
  }

  async getList(url: string) {
    const { dispatch } = this.backgroundApi;
    const res = await this.client.get(url);
    const data = res.data as {
      listedCategories: { name: string; _id: string }[];
      tagDapps: TagDappsType[];
    };

    dispatch(
      setHomeData({
        categories: data.listedCategories,
        tagDapps: data.tagDapps,
      }),
      cleanOldState(),
    );
  }

  @backgroundMethod()
  async getCategoryDapps(categoryId: string) {
    const url = `${this.baseUrl}/get_listing_category_dapps?categoryId=${categoryId}`;
    const res = await this.client.get(url);
    const data = res.data as DAppItemType[];
    return data;
  }

  @backgroundMethod()
  async getTagDapps(tagId: string) {
    const url = `${this.baseUrl}/get_listing_tag_dapps?tagId=${tagId}`;
    const res = await this.client.get(url);
    const data = res.data as DAppItemType[];
    return data;
  }

  @backgroundMethod()
  async getDappsByIds(dappIds: string[]) {
    const url = `${this.baseUrl}/get_listing_dapps`;
    const res = await this.client.post(url, { dappIds });
    const data = res.data as DAppItemType[];
    return data;
  }

  @backgroundMethod()
  async searchDapps(keyword: string) {
    const url = `${this.baseUrl}/search_dapps?keyword=${keyword}`;
    const res = await this.client.get(url);
    const data = res.data as DAppItemType[];
    return data;
  }

  @backgroundMethod()
  async searchDappsWithUrl(urls: string[]) {
    const url = `${this.baseUrl}/search_dapps_by_url`;
    const res = await this.client.post(url, { urls });
    const data = res.data as DAppItemType[];
    return data;
  }

  @backgroundMethod()
  async searchDappsWithRegExp(urls: string[]) {
    const url = `${this.baseUrl}/search_dapps_by_url_regexp`;
    const res = await this.client.post(url, { urls });
    const data = res.data as DAppItemType[];
    return data;
  }

  @backgroundMethod()
  async fetchUrlInfo(input: string) {
    const { baseUrl } = this;
    const url = `${baseUrl}/url_info`;
    const res = await this.client.post(url, { url: input });
    const data = res.data as UrlInfo;
    return data;
  }

  @backgroundMethod()
  async getCompactList() {
    const url = `${this.baseUrl}/compact_list`;
    await this.getList(url);
  }

  @backgroundMethod()
  async fetchData() {
    if (Date.now() - this.updatedAt > 60 * 1000) {
      await this.getCompactList();
      this.updatedAt = Date.now();
    }
  }

  @backgroundMethod()
  removeWebSiteHistory(key: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(removeWebSiteHistory(key));
  }

  @backgroundMethod()
  async migrateFavorite() {
    const { dispatch, appSelector } = this.backgroundApi;
    const dappFavorites = appSelector((s) => s.discover.dappFavorites);
    const favoritesMigrated = appSelector((s) => s.discover.favoritesMigrated);
    const currentBookmarks = appSelector((s) => s.discover.bookmarks);

    if (favoritesMigrated || !dappFavorites || dappFavorites.length === 0) {
      return;
    }

    let bookmarks = dappFavorites.map((item) => ({
      id: uuid.v4(),
      url: item,
    })) as BookmarkItem[];

    for (let i = 0; i < bookmarks.length; i += 1) {
      const bookmark = bookmarks[i];

      const info = await this.getUrlInfo(bookmark.url);
      if (info) {
        bookmark.title = info.title;
        bookmark.icon = info.icon;
      }
    }

    if (currentBookmarks) {
      bookmarks = currentBookmarks.concat(bookmarks);
    }

    debugLogger.common.info(
      `migrate favorite to bookmarks ${JSON.stringify(bookmarks)}`,
    );

    dispatch(resetBookmarks(bookmarks), setFavoritesMigrated());
  }

  @backgroundMethod()
  async editFavorite(item: BookmarkItem) {
    const { dispatch } = this.backgroundApi;
    dispatch(updateBookmark(item));
    const url = item.url.trim();
    if (url) {
      try {
        const urlInfo = await this.getUrlInfo(item.url);
        const newItem = { ...item, icon: urlInfo?.icon };
        dispatch(updateBookmark(newItem));
      } catch {
        console.error(`fetch ${item.url} url info failure`);
      }
    }
  }

  @backgroundMethod()
  async getUrlInfo(url: string) {
    try {
      const dapps = await this.searchDappsWithRegExp([url]);
      if (dapps && dapps.length > 0) {
        const item = dapps[0];
        return { title: item.name, icon: item.logoURL };
      }
      const urlInfo = await this.fetchUrlInfo(url);
      if (urlInfo) {
        return { title: urlInfo.title, icon: urlInfo.icon };
      }
    } catch (e: unknown) {
      debugLogger.common.error(
        `failed to fetch dapp url info with reason ${(e as Error).message}`,
      );
      return { title: '', icon: '' };
    }
  }

  @backgroundMethod()
  async addFavorite(url: string) {
    const { dispatch, appSelector } = this.backgroundApi;
    const bookmarkId = uuid.v4() as string;
    const tabs = appSelector((s) => s.webTabs.tabs);
    const list = tabs.filter((tab) => tab.url === url);
    const base = addBookmark({ url, id: bookmarkId });

    const actions = list.map((tab) =>
      setWebTabData({ ...tab, isBookmarked: true }),
    );
    dispatch(base, ...actions);

    const urlInfo = await this.getUrlInfo(url);
    if (urlInfo) {
      dispatch(
        updateBookmark({
          id: bookmarkId,
          url,
          title: urlInfo.title,
          icon: urlInfo.icon,
        }),
      );
    }
  }

  @backgroundMethod()
  async removeFavorite(url: string) {
    const { dispatch, appSelector } = this.backgroundApi;
    const bookmarks = appSelector((s) => s.discover.bookmarks);
    const item = bookmarks?.find((o) => o.url === url);
    if (item) {
      const base = removeBookmark(item);
      const tabs = appSelector((s) => s.webTabs.tabs);
      const list = tabs.filter((tab) => tab.url === url);
      const actions = list.map((tab) =>
        setWebTabData({ ...tab, isBookmarked: false }),
      );
      dispatch(base, ...actions);
    }
  }

  @backgroundMethod()
  async toggleFavorite(url?: string) {
    if (!url) {
      return;
    }
    const { appSelector } = this.backgroundApi;
    const bookmarks = appSelector((s) => s.discover.bookmarks);
    const urls = bookmarks?.map((item) => item.url);
    if (!urls || !urls.includes(url)) {
      this.addFavorite(url);
    } else {
      this.removeFavorite(url);
    }
  }

  @backgroundMethod()
  async setDappHistory(dappId: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(setDappHistory(dappId));
  }

  @backgroundMethod()
  async removeDappHistory(dappId: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(removeDappHistory(dappId));
  }

  @backgroundMethod()
  async removeMatchItem(item: MatchDAppItemType) {
    if (item.dapp) {
      this.removeDappHistory(item.id);
      this.backgroundApi.dispatch(
        removeUserBrowserHistory({ url: item.dapp?.url }),
      );
    }
    if (item.webSite && item.webSite.url && new URL(item.webSite.url).host) {
      this.removeWebSiteHistory(new URL(item.webSite.url).host);
      this.backgroundApi.dispatch(
        removeUserBrowserHistory({ url: item.webSite.url }),
      );
    }
  }

  @backgroundMethod()
  async clearHistory() {
    this.backgroundApi.dispatch(clearHistory());
  }
}

export default ServicDiscover;
