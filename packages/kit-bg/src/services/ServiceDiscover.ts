/* eslint-disable @typescript-eslint/require-await */
import axios from 'axios';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import {
  addFavorite,
  cleanOldState,
  clearHistory,
  removeDappHistory,
  removeFavorite,
  removeWebSiteHistory,
  setDappHistory,
  // setCategoryDapps,
  // setDappItems,
  // setListedCategories,
  // setListedTags,
  // setTagDapps,
  setHomeData,
} from '@onekeyhq/kit/src/store/reducers/discover';
import { setWebTabData } from '@onekeyhq/kit/src/store/reducers/webTabs';
import type { MatchDAppItemType } from '@onekeyhq/kit/src/views/Discover/Explorer/explorerUtils';
import type { DAppItemType, TagDappsType } from '@onekeyhq/kit/src/views/Discover/type';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServicDiscover extends ServiceBase {
  updatedAt = 0;

  get client() {
    return axios.create({ timeout: 60 * 1000 });
  }

  get baseUrl() {
    // const url = getFiatEndpoint();
    const url = 'http://localhost:9000';
    return `${url}/discover`;
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
    this.getList(url);
  }

  @backgroundMethod()
  async fetchData() {
    this.getCompactList();
  }

  @backgroundMethod()
  removeWebSiteHistory(key: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(removeWebSiteHistory(key));
  }

  @backgroundMethod()
  async addFavorite(url: string) {
    const { dispatch, appSelector } = this.backgroundApi;
    const base = addFavorite(url);
    const tabs = appSelector((s) => s.webTabs.tabs);
    const list = tabs.filter((tab) => tab.url === url);
    const actions = list.map((tab) =>
      setWebTabData({ ...tab, isBookmarked: true }),
    );
    dispatch(base, ...actions);
  }

  @backgroundMethod()
  async removeFavorite(url: string) {
    const { dispatch, appSelector } = this.backgroundApi;
    const base = removeFavorite(url);
    const tabs = appSelector((s) => s.webTabs.tabs);
    const list = tabs.filter((tab) => tab.url === url);
    const actions = list.map((tab) =>
      setWebTabData({ ...tab, isBookmarked: false }),
    );
    dispatch(base, ...actions);
  }

  @backgroundMethod()
  async toggleFavorite(url?: string) {
    if (!url) {
      return;
    }
    const { appSelector } = this.backgroundApi;
    const dappFavorites = appSelector((s) => s.discover.dappFavorites);
    if (!dappFavorites || !dappFavorites.includes(url)) {
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
    }
    if (item.webSite && item.webSite.url && new URL(item.webSite.url).host) {
      this.removeWebSiteHistory(new URL(item.webSite.url).host);
    }
  }

  @backgroundMethod()
  async clearHistory() {
    this.backgroundApi.dispatch(clearHistory());
  }
}

export default ServicDiscover;
