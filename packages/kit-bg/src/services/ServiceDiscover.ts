/* eslint-disable @typescript-eslint/require-await */

import { batch } from '@legendapp/state';
import uuid from 'react-native-uuid';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { webTabsActions } from '@onekeyhq/kit/src/store/observable/webTabs';
import {
  addBookmark,
  cleanOldState,
  clearHistory,
  refreshUserBrowserHistoryTimestamp,
  removeBookmark,
  removeDappHistory,
  removeUserBrowserHistory,
  removeWebSiteHistory,
  resetBookmarks,
  setDappHistory,
  setFavoritesMigrated,
  setHomeData,
  setUserBrowserHistory,
  updateBookmark,
} from '@onekeyhq/kit/src/store/reducers/discover';
import { getWebTabs } from '@onekeyhq/kit/src/views/Discover/Explorer/Controller/useWebTabs';
import type { MatchDAppItemType } from '@onekeyhq/kit/src/views/Discover/Explorer/explorerUtils';
import type {
  BookmarkItem,
  DAppItemType,
  TagDappsType,
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
    this.organizeHistory();
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

  organizeHistory() {
    const { appSelector, dispatch } = this.backgroundApi;
    const userBrowserHistories = appSelector(
      (s) => s.discover.userBrowserHistories,
    );
    let actions: any[] = [];
    if (userBrowserHistories && userBrowserHistories.length > 0) {
      const noTimestampHistoryItems = userBrowserHistories?.filter(
        (o) => !o.timestamp,
      );
      if (noTimestampHistoryItems.length > 0) {
        const refreshHistoryTimestampActions = noTimestampHistoryItems.map(
          (item) => refreshUserBrowserHistoryTimestamp({ url: item.url }),
        );
        actions = actions.concat(refreshHistoryTimestampActions);
      }

      const now = Date.now();
      const oldHistory = userBrowserHistories.filter(
        (o) => o.timestamp && now - o.timestamp > 30 * 24 * 60 * 60 * 1000,
      );
      if (oldHistory.length) {
        const removeUserBrowserHistoryActions = oldHistory.map((item) =>
          removeUserBrowserHistory({ url: item.url }),
        );
        actions = actions.concat(removeUserBrowserHistoryActions);
      }
    }
    if (actions.length > 0) {
      dispatch(...actions);
    }
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
      const { serviceDappMetaData } = this.backgroundApi;
      const urlInfo = await serviceDappMetaData.getUrlMeta({ url });
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
  async updateUserBrowserHistoryLogo(params: { dappId?: string; url: string }) {
    const { dispatch } = this.backgroundApi;
    const { dappId, url } = params;
    const urlInfo = await this.getUrlInfo(url);
    if (urlInfo) {
      dispatch(
        setUserBrowserHistory({
          dappId,
          url,
          title: urlInfo.title,
          logoUrl: urlInfo.icon,
        }),
      );
    }
  }

  @backgroundMethod()
  async addFavorite(url: string) {
    const { dispatch } = this.backgroundApi;
    const bookmarkId = uuid.v4() as string;
    const { tabs } = getWebTabs();
    const list = tabs.filter((tab) => tab.url === url);

    dispatch(addBookmark({ url, id: bookmarkId }));
    batch(() => {
      list.forEach((tab) =>
        webTabsActions.setWebTabData({ ...tab, isBookmarked: true }),
      );
    });

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
      const { tabs } = getWebTabs();
      const list = tabs.filter((tab) => tab.url === url);
      dispatch(base);
      batch(() => {
        list.forEach((tab) =>
          webTabsActions.setWebTabData({ ...tab, isBookmarked: false }),
        );
      });
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
