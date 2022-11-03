import axios, { Method } from 'axios';
import qs from 'qs';

import { ISimpleSearchHistoryToken } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityMarket';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { formatServerToken } from '@onekeyhq/engine/src/managers/token';

import {
  MARKET_FAVORITES_CATEGORYID,
  MarketCategory,
  MarketListSortType,
  MarketTokenItem,
  MarketTopTabName,
  cancleMarketFavorite,
  clearMarketSearchTokenHistory,
  moveTopMarketFavorite,
  saveMarketCategorys,
  saveMarketFavorite,
  saveMarketSearchTokenHistory,
  switchMarketTopTab,
  syncMarketSearchTokenHistorys,
  updateMarketChats,
  updateMarketListSort,
  updateMarketTokenDetail,
  updateMarketTokens,
  updateMarketTokensBaseInfo,
  updateSearchKeyword,
  updateSearchTabCategory,
  updateSearchTokens,
  updateSelectedCategory,
} from '../../store/reducers/market';
import { ServerToken } from '../../store/typings';
import { getDefaultLocale } from '../../utils/locale';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceMarket extends ServiceBase {
  @backgroundMethod()
  async fetchMarketCategorys() {
    const { appSelector, dispatch } = this.backgroundApi;
    const locale = appSelector((s) => s.settings.locale);
    const path = '/market/category/list';
    const datas: MarketCategory[] = await this.fetchData(
      path,
      { locale: locale === 'system' ? getDefaultLocale() : locale },
      [],
    );

    // add favorite coingeckoIds from db
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

    // toggle default category
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
    ids,
    sparkline,
  }: {
    categoryId?: string;
    ids?: string;
    sparkline?: boolean;
  }) {
    const { dispatch, appSelector } = this.backgroundApi;
    const path = '/market/tokens';
    const coingeckoIds = ids && ids.length > 0 ? ids : undefined;
    const vsCurrency = appSelector((s) => s.settings.selectedFiatMoneySymbol);
    const data = await this.fetchData<MarketTokenItem[]>(
      path,
      {
        category: categoryId,
        vs_currency: vsCurrency ?? 'usd',
        ids: coingeckoIds,
        sparkline,
      },
      [],
    );
    if (data.length === 0) {
      return;
    }
    dispatch(updateMarketTokens({ categoryId, marketTokens: data }));
    // check token base(tokens & logoURI)
    const marketTokens = appSelector((s) => s.market.marketTokens);
    const imperfectMatketTokens = data.filter(
      (t) => !marketTokens[t.coingeckoId]?.tokens,
    );
    if (imperfectMatketTokens?.length) {
      this.fetchMarketTokensBaseInfo(
        imperfectMatketTokens.map((t) => t.coingeckoId).join(','),
      );
    }
  }

  async fetchMarketTokensBaseInfo(marketTokenIds: string) {
    const path = '/market/tokens/base/';
    const data = await this.fetchData<
      {
        coingeckoId: string;
        tokens: ServerToken[];
        logoURI?: string;
      }[]
    >(path, { coingeckoIds: marketTokenIds }, []);
    const tokensBaseInfo = data.map((tokenBase) => {
      const tokens = tokenBase.tokens.map((t) => formatServerToken(t));
      return { ...tokenBase, tokens };
    });
    this.backgroundApi.dispatch(updateMarketTokensBaseInfo(tokensBaseInfo));
    return tokensBaseInfo;
  }

  @backgroundMethod()
  async fetchMarketDetail(coingeckoId: string) {
    const { appSelector, dispatch } = this.backgroundApi;
    const locale = appSelector((s) => s.settings.locale);
    const path = '/market/detail';
    const data = await this.fetchData(
      path,
      {
        id: coingeckoId,
        locale: locale === 'system' ? getDefaultLocale() : locale,
      },
      null,
    );
    if (data) {
      dispatch(updateMarketTokenDetail({ coingeckoId, data }));
    }
  }

  // @backgroundMethod()
  // async fetchMarketTokenFavoritesForNtf() {
  //   const path = '/notification/favorite';
  //   const { dispatch, appSelector } = this.backgroundApi;
  //   const instanceId = appSelector((s) => s.settings.instanceId);
  //   const data = await this.fetchData(path, { instanceId }, []);
  //   if (data.length > 0) {
  //     const coingeckoIds = data.map(
  //       (t: { coingeckoId: string }) => t.coingeckoId,
  //     );
  //   }
  // }

  @backgroundMethod()
  async marketTokenCancelFavoriteForNtf(coingeckoId: string) {
    const path = '/notification/favorite';
    const { appSelector } = this.backgroundApi;
    const instanceId = appSelector((s) => s.settings.instanceId);
    const data = await this.fetchData<{
      acknowledged: boolean;
      deletedCount: number;
    } | null>(path, { instanceId, coingeckoId }, null, 'DELETE');
    if (data && data.acknowledged) {
      return Promise.resolve(true);
    }
    return Promise.resolve(false); // { "acknowledged": true, "deletedCount": 1}
  }

  @backgroundMethod()
  async marketTokenAddFavoriteForNtf(coingeckoId: string, symbol: string) {
    const path = '/notification/favorite';
    const { appSelector } = this.backgroundApi;
    const instanceId = appSelector((s) => s.settings.instanceId);
    const data = await this.fetchData<{ coingeckoId: string } | null>(
      path,
      { instanceId, coingeckoId, symbol },
      null,
      'POST',
    );
    if (data && data.coingeckoId) {
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  @backgroundMethod()
  async fetchMarketTokenChart({
    coingeckoId,
    days = '1',
    points = '100',
  }: {
    coingeckoId: string;
    days: string;
    points?: string;
  }): Promise<[number, number][]> {
    const path = '/market/token/chart';
    const data = await this.fetchData(
      path,
      {
        coingeckoId,
        days,
        points,
      },
      [],
    );
    if (data.length > 0) {
      this.backgroundApi.dispatch(
        updateMarketChats({ coingeckoId, chart: data, days }),
      );
    }
    return Promise.resolve([]);
  }

  @backgroundMethod()
  updateMarketSearchKeyword({ searchKeyword }: { searchKeyword: string }) {
    this.backgroundApi.dispatch(updateSearchKeyword(searchKeyword));
  }

  @backgroundMethod()
  async fetchMarketSearchTokens({ searchKeyword }: { searchKeyword: string }) {
    if (searchKeyword.length === 0) return;
    const path = '/market/search/';
    const data = await this.fetchData(path, { query: searchKeyword }, []);
    this.backgroundApi.dispatch(
      updateSearchTokens({ searchKeyword, coingeckoIds: data }),
    );
    // updata tokenItem for redux
    if (data.length > 0) {
      this.fetchMarketList({
        ids: data.join(','),
        sparkline: false,
      });
    }
  }

  async fetchData<T>(
    path: string,
    query: Record<string, unknown> = {},
    fallback: T,
    method: Method = 'GET',
  ): Promise<T> {
    const endpoint = getFiatEndpoint();
    try {
      const isPost = method === 'POST' || method === 'post';
      const apiUrl = `${endpoint}${path}${
        !isPost ? `?${qs.stringify(query)}` : ''
      }`;
      const postData = isPost ? query : undefined;
      const requestConfig = { url: apiUrl, method, data: postData };
      const { data } = await axios.request<T>(requestConfig);
      return data;
    } catch (e) {
      console.error(e);
      return fallback;
    }
  }

  async getMarketFavoriteTokens() {
    return simpleDb.market.getFavoriteMarketTokens();
  }

  @backgroundMethod()
  async saveMarketFavoriteTokens(
    favorites: { coingeckoId: string; symbol?: string }[],
  ) {
    const coingeckoIds = favorites.map((f) => f.coingeckoId);
    this.backgroundApi.dispatch(saveMarketFavorite(coingeckoIds));
    for (const f of favorites) {
      await this.marketTokenAddFavoriteForNtf(
        f.coingeckoId,
        f.symbol ?? 'UNKOWN',
      );
    }
    return simpleDb.market.saveFavoriteMarketTokens(coingeckoIds);
  }

  @backgroundMethod()
  async clearMarketFavoriteTokens() {
    return simpleDb.market.clearRawData();
  }

  @backgroundMethod()
  async cancelMarketFavoriteToken(coingeckoId: string) {
    this.backgroundApi.dispatch(cancleMarketFavorite(coingeckoId));
    this.marketTokenCancelFavoriteForNtf(coingeckoId);
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

  @backgroundMethod()
  switchMarketTopTab(tabName: MarketTopTabName) {
    this.backgroundApi.dispatch(switchMarketTopTab(tabName));
  }

  @backgroundMethod()
  async syncSearchHistory() {
    const historys = await simpleDb.market.getMarketSearchHistoryToken();
    this.backgroundApi.dispatch(
      syncMarketSearchTokenHistorys({ tokens: historys }),
    );
  }

  @backgroundMethod()
  async saveSearchHistory(token: ISimpleSearchHistoryToken) {
    this.backgroundApi.dispatch(saveMarketSearchTokenHistory({ token }));
    return simpleDb.market.saveMarketSearchHistoryToken(token);
  }

  @backgroundMethod()
  async clearSearchHistory() {
    this.backgroundApi.dispatch(clearMarketSearchTokenHistory());
    return simpleDb.market.clearMarketSearchHistoryToken();
  }

  @backgroundMethod()
  setMarketSearchTab(categoryId: string | number | undefined) {
    if (categoryId && typeof categoryId === 'string') {
      this.backgroundApi.dispatch(updateSearchTabCategory(categoryId));
    }
  }
}
