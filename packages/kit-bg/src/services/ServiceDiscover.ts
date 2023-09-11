/* eslint-disable @typescript-eslint/require-await */

import { batch } from '@legendapp/state';
import uuid from 'react-native-uuid';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { webTabsActions } from '@onekeyhq/kit/src/store/observable/webTabs';
import { clearTranslations } from '@onekeyhq/kit/src/store/reducers/data';
import {
  addBookmark,
  cleanOldState,
  clearHistory,
  removeBookmark,
  removeUserBrowserHistory,
  resetBookmarks,
  setFavoritesMigrated,
  updateBookmark,
  updateUserBrowserHistory,
} from '@onekeyhq/kit/src/store/reducers/discover';
import { getDefaultLocale } from '@onekeyhq/kit/src/utils/locale';
import { getWebTabs } from '@onekeyhq/kit/src/views/Discover/Explorer/Controller/useWebTabs';
import type { MatchDAppItemType } from '@onekeyhq/kit/src/views/Discover/Explorer/explorerUtils';
import type {
  BookmarkItem,
  CategoryType,
  DAppItemType,
  GroupDappsType,
} from '@onekeyhq/kit/src/views/Discover/type';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import flowLogger from '@onekeyhq/shared/src/logger/flowLogger/flowLogger';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServicDiscover extends ServiceBase {
  get baseUrl() {
    const url = getFiatEndpoint();
    return `${url}/discover`;
  }

  getLanguage() {
    const { appSelector } = this.backgroundApi;
    const locale = appSelector((s) => s.settings.locale);
    const language = locale === 'system' ? getDefaultLocale() : locale;
    return language;
  }

  init() {
    this.migrateFavorite();
    this.organizeHistory();
    this.clearData();
  }

  clearData() {
    const { dispatch } = this.backgroundApi;
    dispatch(cleanOldState());
    dispatch(clearTranslations());
  }

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
          (item) =>
            updateUserBrowserHistory({ url: item.url, timestamp: Date.now() }),
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
  async getHomePageData(categoryId?: string) {
    const url = `${this.baseUrl}/home_page_data`;
    const res = await this.client.get(url, {
      params: { categoryId, language: this.getLanguage() },
    });
    const data = res.data as {
      items: GroupDappsType[];
      categories: CategoryType[];
    };
    return data;
  }

  @backgroundMethod()
  async getCategoryDapps(categoryId: string) {
    const url = `${this.baseUrl}/get_listing_category_dapps`;
    const res = await this.client.get(url, {
      params: { categoryId, language: this.getLanguage() },
    });
    const data = res.data as DAppItemType[];
    return data;
  }

  @backgroundMethod()
  async getTagDapps(tagId: string) {
    const url = `${this.baseUrl}/get_listing_tag_dapps`;
    const res = await this.client.get(url, {
      params: { tagId, language: this.getLanguage() },
    });
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
      flowLogger.error.log(
        `failed to fetch dapp url info with reason ${(e as Error).message}`,
      );
      return { title: '', icon: '' };
    }
  }

  @backgroundMethod()
  async fillInUserBrowserHistory(params: { dappId?: string; url: string }) {
    const { dispatch, appSelector } = this.backgroundApi;
    const { dappId, url } = params;
    const userBrowserHistories = appSelector(
      (s) => s.discover.userBrowserHistories,
    );
    if (!userBrowserHistories || userBrowserHistories.length === 0) {
      return;
    }
    const index = userBrowserHistories.findIndex((o) => o.url === url);
    if (index < 0) {
      return;
    }
    const current = userBrowserHistories[index];
    if (current.logoUrl && current.title) {
      return;
    }
    let title = '';
    let logoUrl = '';
    if (dappId) {
      const dapps = await this.getDappsByIds([dappId]);
      if (dapps.length > 0) {
        const dapp = dapps[0];
        title = dapp.name;
        logoUrl = dapp.logoURL;
      }
    }
    if (!title || !logoUrl) {
      const urlInfo = await this.getUrlInfo(url);
      if (!title) {
        title = urlInfo?.title || '';
      }
      if (!logoUrl) {
        logoUrl = urlInfo?.icon || '';
      }
    }
    if (title || logoUrl) {
      const data = { ...current };
      if (!data.logoUrl && logoUrl) {
        data.logoUrl = logoUrl;
      }
      if (!data.title && title) {
        data.title = title;
      }
      dispatch(updateUserBrowserHistory(data));
    }
  }

  @backgroundMethod()
  async addFavorite(url: string) {
    const { dispatch, serviceCloudBackup } = this.backgroundApi;
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
    serviceCloudBackup.requestBackup();
  }

  @backgroundMethod()
  async removeFavorite(url: string) {
    const { dispatch, appSelector, serviceCloudBackup } = this.backgroundApi;
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
    serviceCloudBackup.requestBackup();
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
  async removeMatchItem(item: MatchDAppItemType) {
    if (item.dapp) {
      this.backgroundApi.dispatch(
        removeUserBrowserHistory({ url: item.dapp?.url }),
      );
    }
    if (item.webSite && item.webSite.url && new URL(item.webSite.url).host) {
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
