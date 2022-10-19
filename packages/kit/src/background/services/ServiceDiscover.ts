/* eslint-disable @typescript-eslint/require-await */
import axios from 'axios';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';

import {
  addFavorite,
  removeDappHistory,
  removeFavorite,
  removeWebSiteHistory,
  setCategories,
  setCategoryItems,
  setDappHistory,
  setDappItems,
  setTagItems,
  setTags,
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
  async getDapps() {
    const { dispatch, appSelector } = this.backgroundApi;
    const dapps = appSelector((s) => s.discover.dappItems);
    if (
      dapps &&
      dapps.length > 0 &&
      Date.now() - this.updatedAt < 60 * 60 * 1000
    ) {
      return;
    }
    const url = `${this.baseUrl}/get_listing`;
    const res = await this.client.get(url);
    const data = res.data as {
      dapps: DAppItemType[];
      tags: { name: string; _id: string }[];
      categories: { name: string; _id: string }[];
    };
    const categoryItems: Record<string, DAppItemType[]> = {};
    const tagItems: Record<string, DAppItemType[]> = {};
    data.dapps?.forEach((item) => {
      const categoryIds = item.categories.map((a) => a._id);
      categoryIds.forEach((id) => {
        if (!categoryItems[id]) {
          categoryItems[id] = [];
        }
        categoryItems[id].push(item);
      });
      const tagIds = item.tags.map((a) => a._id);
      tagIds.forEach((id) => {
        if (!tagItems[id]) {
          tagItems[id] = [];
        }
        tagItems[id].push(item);
      });
    });

    dispatch(
      setDappItems(data.dapps),
      setTags(data.tags),
      setTagItems(tagItems),
      setCategories(data.categories),
      setCategoryItems(categoryItems),
    );

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
}

export default ServicDiscover;
