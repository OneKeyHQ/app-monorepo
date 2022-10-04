import axios from 'axios';
import qs from 'qs';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';

import {
  MarketCategory,
  saveMarketCategorys,
  updataCurrentCategory,
  updataMarketCategoryTokenMap,
  saveMarketFavorite,
  cancleMarketFavorite,
} from '../../store/reducers/market';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceMarket extends ServiceBase {
  // todo 开启定时轮询，需要当前选中的 category 和 market 页面是否激活
  @backgroundMethod()
  async fetchMarketCategorys() {
    const { appSelector, dispatch } = this.backgroundApi;
    const path = '/market/category/list';
    const datas: MarketCategory[] = await this.fetchData(path, {}, []);

    // 填充favorite coingeckoIds
    const favorites = datas.filter((d) => d.categoryId === 'favorites');
    if (favorites && favorites.length > 0) {
      const { coingeckoIds } = favorites[0];
      favorites[0].coingeckoIds = [
        ...new Set(coingeckoIds?.concat(await this.getMarketFavorites())),
      ];
    }
    dispatch(saveMarketCategorys(datas));

    // 切换到默认分类
    const currentCategory = appSelector((s) => s.market.currentCategory);
    const categorys = appSelector((s) => s.market.categorys);
    const defaultCategory = categorys.find((c) => c.defaultSelected);
    if (!currentCategory && defaultCategory) {
      this.toggleCategory(defaultCategory);
    }
  }

  @backgroundMethod()
  toggleCategory(category: MarketCategory) {
    this.backgroundApi.dispatch(updateCurrentCategory(category));
    this.fetchMarketList({
      categoryId: category.categoryId,
      vsCurrency: 'usd',
      ids: category.coingeckoIds?.join(','),
      sparkline: true,
    });
  }

  async fetchMarketList({
    categoryId,
    vsCurrency,
    ids,
    sparkline,
  }: {
    categoryId: string;
    vsCurrency: string;
    ids?: string;
    sparkline?: boolean;
  }) {
    const path = '/market/tokens';
    const coingeckoIds = ids && ids.length > 0 ? ids : undefined;
    const data = await this.fetchData(
      path,
      {
        category: categoryId,
        vs_currency: vsCurrency,
        ids: coingeckoIds,
        sparkline,
      },
      [],
    );
    console.log('data---', data);
    this.backgroundApi.dispatch(
      updateMarketCategoryTokenMap({ categoryId, marketTokens: data }),
    );
  }

  async fetchData<T>(
    path: string,
    query: Record<string, unknown> = {},
    fallback: T,
  ): Promise<T> {
    const endpoint = getFiatEndpoint();
    const apiUrl = `${endpoint}${path}?${qs.stringify(query)}`;
    console.log('apiUrl--', apiUrl);
    try {
      const { data } = await axios.get<T>(apiUrl);
      return data;
    } catch (e) {
      console.error(e);
      return fallback;
    }
  }

  @backgroundMethod()
  async getTokenSupportImpl(coingeckoId: string) {
    const path = '/market/token/impls';
    const data = await this.fetchData(path, { coingeckoId }, []);
    console.log('token impl data', data);
    // todo redux
    return data;
  }

  updateFavoriteTokenList() {
    const { appSelector } = this.backgroundApi;
    const categorys = appSelector((s) => s.market.categorys);
    const favoriteCategory = categorys.find(
      (c) => c.categoryId === 'favorites',
    );
    this.fetchMarketList({
      categoryId: 'favorites',
      vsCurrency: 'usd',
      ids: favoriteCategory?.coingeckoIds?.join(','),
      sparkline: true,
    });
  }

  async getMarketFavorites() {
    return simpleDb.market.getFavoriteCoins();
  }

  @backgroundMethod()
  async saveMarketFavoriteCoin(coingeckoId: string) {
    this.backgroundApi.dispatch(saveMarketFavorite(coingeckoId));
    // trigger favorites category token update
    this.updateFavoriteTokenList();
    return simpleDb.market.saveFavoriteCoin(coingeckoId);
  }

  @backgroundMethod()
  async cancelMarketFavoriteCoin(coingeckoId: string) {
    this.backgroundApi.dispatch(cancleMarketFavorite(coingeckoId));
    this.updateFavoriteTokenList();
    return simpleDb.market.deleteFavoriteCoin(coingeckoId);
  }

  async fetchMarketDetail(coingeckoId: string) {
    return Promise.resolve({});
  }

  async fetchMarketTokenChart({
    coingeckoId,
    days,
    points = '100',
  }: {
    coingeckoId: string;
    days: string;
    points?: string;
  }): Promise<[number, number][]> {
    return Promise.resolve([]);
  }

  //   @backgroundMethon()
  //   async getMarketFacoriteStatus(coingeckoId:string) {

  //   }
}
