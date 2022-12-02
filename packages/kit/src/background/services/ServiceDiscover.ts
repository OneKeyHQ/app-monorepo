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
    const url = getFiatEndpoint();
    return `${url}/discover`;
  }

  async getList(url: string) {
    const { dispatch } = this.backgroundApi;
    const res = await this.client.get(url);
    const data = res.data as {
      listedCategories: { name: string; _id: string }[];
      // listedTags: { name: string; _id: string }[];
      // categoryDapps: { label: string; id: string; items: DAppItemType[] }[];
      tagDapps: { label: string; id: string; items: DAppItemType[] }[];
    };

    dispatch(
      // setCategoryDapps(data.categoryDapps),
      // setListedCategories(data.listedCategories),
      // setTagDapps(data.tagDapps),
      // setListedTags(data.listedTags),
      // setDappItems(dapps),
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
