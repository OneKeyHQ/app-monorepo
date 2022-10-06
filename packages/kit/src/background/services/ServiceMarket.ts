import axios from 'axios';
import qs from 'qs';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';

import {
  MARKET_FAVORITES_CATEGORYID,
  MarketCategory,
  MarketListSortType,
  cancleMarketFavorite,
  moveTopMarketFavorite,
  saveMarketCategorys,
  saveMarketFavorite,
  updateMarketListSort,
  updateMarketTokenIpmlChainId,
  updateMarketTokens,
  updateSelectedCategory,
} from '../../store/reducers/market';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceMarket extends ServiceBase {
  @backgroundMethod()
  async fetchMarketCategorys() {
    const { appSelector, dispatch } = this.backgroundApi;
    const path = '/market/category/list';
    const datas: MarketCategory[] = await this.fetchData(path, {}, []);

    // 填充favorite coingeckoIds
    const favorites = datas.find(
      (d) => d.categoryId === MARKET_FAVORITES_CATEGORYID,
    );
    if (favorites) {
      favorites.coingeckoIds = [
        ...new Set(
          favorites.coingeckoIds?.concat(await this.getMarketFavoriteTokens()),
        ),
      ];
    }
    dispatch(saveMarketCategorys(datas));

    // 切换到默认分类
    const selectedCategoryId = appSelector((s) => s.market.selectedCategoryId);
    const categorys = appSelector((s) => s.market.categorys);
    const defaultCategory = Object.values(categorys).find(
      (c) => c.defaultSelected,
    );
    if (!selectedCategoryId && defaultCategory) {
      this.toggleCategory(defaultCategory);
    }
  }

  @backgroundMethod()
  toggleCategory(category: MarketCategory) {
    this.updateMarketListSort(null);
    this.backgroundApi.dispatch(updateSelectedCategory(category.categoryId));
  }

  @backgroundMethod()
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
    if (data.length === 0) {
      return;
    }
    this.backgroundApi.dispatch(
      updateMarketTokens({ categoryId, marketTokens: data }),
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
  async fetchTokenSupportImpl(coingeckoId: string) {
    const path = '/market/token/impls';
    const data = await this.fetchData(path, { coingeckoId }, []);
    this.backgroundApi.dispatch(
      updateMarketTokenIpmlChainId({ coingeckoId, implChainIds: data }),
    );
    return data;
  }

  async getMarketFavoriteTokens() {
    return simpleDb.market.getFavoriteMarketTokens();
  }

  @backgroundMethod()
  async saveMarketFavoriteTokens(coingeckoIds: string[]) {
    this.backgroundApi.dispatch(saveMarketFavorite(coingeckoIds));
    return simpleDb.market.saveFavoriteMarketTokens(coingeckoIds);
  }

  @backgroundMethod()
  async clearMarketFavoriteTokens() {
    return simpleDb.market.clearRawData();
  }

  @backgroundMethod()
  async cancelMarketFavoriteToken(coingeckoId: string) {
    this.backgroundApi.dispatch(cancleMarketFavorite(coingeckoId));
    return simpleDb.market.deleteFavoriteMarketToken(coingeckoId);
  }

  @backgroundMethod()
  async moveTopMarketFavoriteToken(coingeckoId: string) {
    this.backgroundApi.dispatch(moveTopMarketFavorite(coingeckoId));
    return simpleDb.market.unshiftFavoriteMarketToken(coingeckoId);
  }

  @backgroundMethod()
  updateMarketListSort(listSort: MarketListSortType | null) {
    this.backgroundApi.dispatch(updateMarketListSort(listSort));
  }

  async fetchMarketDetail(coingeckoId: string) {
    const path = '/detail';
    const data = await this.fetchData(
      path,
      {
        id: coingeckoId,
      },
      null,
    );
    if (data) {
      console.log('detail-data', data);
    }
  }

//   @backgroundMethod()
//   updateMarketSelectedTokenId(coingeckoId: string) {
//     this.backgroundApi.dispatch(this.updateMarketSelectedTokenId(coingeckoId));
//   }

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
