/* eslint-disable @typescript-eslint/require-await */
import axios from 'axios';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';

import {
  addFavorite,
  clearHistory,
  removeDappHistory,
  removeFavorite,
  removeWebSiteHistory,
  setCategoryDapps,
  setDappHistory,
  setDappItems,
  setListedCategories,
  setListedTags,
  setTagDapps,
} from '../../store/reducers/discover';
import { WebTab, setWebTabData } from '../../store/reducers/webTabs';
import { MatchDAppItemType } from '../../views/Discover/Explorer/explorerUtils';
import { DAppItemType } from '../../views/Discover/type';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServicDiscover extends ServiceBase {
  updatedAt = 0;

  get client() {
    return axios.create({ timeout: 60 * 1000 });
  }

  get baseUrl() {
    return `${getFiatEndpoint()}/discover`;
  }

  @backgroundMethod()
  async getAllDapps() {
    const { dispatch } = this.backgroundApi;
    const url = `${this.baseUrl}/dapps`;
    const res = await this.client.get(url);
    const data = res.data as DAppItemType[];
    dispatch(setDappItems(data));
  }

  async getList(url: string) {
    const { dispatch } = this.backgroundApi;
    const res = await this.client.get(url);
    const data = res.data as {
      listedCategories: { name: string; _id: string }[];
      listedTags: { name: string; _id: string }[];
      categoryDapps: { label: string; id: string; items: DAppItemType[] }[];
      tagDapps: { label: string; id: string; items: DAppItemType[] }[];
    };

    let dapps: DAppItemType[] = [];

    dapps = data.categoryDapps.reduce(
      (result, item) => result.concat(item.items),
      dapps,
    );

    dapps = data.tagDapps.reduce(
      (result, item) => result.concat(item.items),
      dapps,
    );

    const set = new Set();

    dapps = dapps.filter((item) => {
      if (!set.has(item._id)) {
        set.add(item._id);
        return true;
      }
      return false;
    });

    dispatch(
      setCategoryDapps(data.categoryDapps),
      setListedCategories(data.listedCategories),
      setTagDapps(data.tagDapps),
      setListedTags(data.listedTags),
      setDappItems(dapps),
    );
  }

  @backgroundMethod()
  async getCompactList() {
    const url = `${this.baseUrl}/compact_list`;
    this.getList(url);
  }

  @backgroundMethod()
  async getFullList() {
    const url = `${this.baseUrl}/full_list`;
    this.getList(url);
  }

  @backgroundMethod()
  async fetchData() {
    const { appSelector } = this.backgroundApi;
    const categoryDapps = appSelector((s) => s.discover.categoryDapps);
    const tagDapps = appSelector((s) => s.discover.tagDapps);
    if (
      tagDapps &&
      tagDapps.length > 0 &&
      categoryDapps &&
      categoryDapps.length > 0 &&
      Date.now() - this.updatedAt < 60 * 1000
    ) {
      return;
    }
    this.getCompactList();
    this.getFullList();

    this.updatedAt = Date.now();
  }

  @backgroundMethod()
  removeWebSiteHistory(key: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(removeWebSiteHistory(key));
  }

  @backgroundMethod()
  async addFavorite(key: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(addFavorite(key));
  }

  @backgroundMethod()
  async removeFavorite(key: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(removeFavorite(key));
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
  async toggleBookmark(tab: WebTab) {
    if (tab.isBookmarked) {
      this.removeBookmark(tab);
    } else {
      this.addBookmark(tab);
    }
  }

  @backgroundMethod()
  async addBookmark(tab: WebTab) {
    const { dispatch } = this.backgroundApi;
    if (tab.isBookmarked) {
      return;
    }
    const newTab: WebTab = { ...tab, isBookmarked: !tab.isBookmarked };
    dispatch(setWebTabData(newTab));
    if (newTab.url) {
      this.addFavorite(newTab.url);
    }
  }

  @backgroundMethod()
  async removeBookmark(tab: WebTab) {
    const { dispatch } = this.backgroundApi;
    if (!tab.isBookmarked) {
      return;
    }
    const newTab: WebTab = { ...tab, isBookmarked: !tab.isBookmarked };
    dispatch(setWebTabData(newTab));
    if (newTab.url) {
      this.removeFavorite(newTab.url);
    }
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
