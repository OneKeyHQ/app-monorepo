import { debounce } from 'lodash';

import type { ISimpleSearchHistoryToken } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityMarket';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { formatServerToken } from '@onekeyhq/engine/src/managers/token';
import type {
  MarketCategory,
  MarketListSortType,
  MarketTokenItem,
  MarketTopTabName,
} from '@onekeyhq/kit/src/store/reducers/market';
import {
  MARKET_FAVORITES_CATEGORYID,
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
} from '@onekeyhq/kit/src/store/reducers/market';
import type { ServerToken } from '@onekeyhq/kit/src/store/typings';
import { getDefaultLocale } from '@onekeyhq/kit/src/utils/locale';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { fetchData } from '@onekeyhq/shared/src/background/backgroundUtils';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceMarket extends ServiceBase {
  @backgroundMethod()
  async fetchMarketCategorys() {
    const { appSelector, dispatch } = this.backgroundApi;
    const locale = appSelector((s) => s.settings.locale);
    const path = '/market/category/list';
    const datas: MarketCategory[] = await fetchData(
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
      this.toggleCategory(defaultCategory.categoryId);
    }
  }

  @backgroundMethod()
  toggleCategory(categoryId: string) {
    this.updateMarketListSort(null);
    this.backgroundApi.dispatch(updateSelectedCategory(categoryId));
  }

  // fix desktop quickly click the Cancel Like button to trigger the change of the like favorites ids, resulting in a pull action.

  // eslint-disable-next-line @typescript-eslint/unbound-method
  _fetchMarketListDebounced = debounce(this.fetchMarketList, 1200, {
    leading: false,
    trailing: true,
  });

  @backgroundMethod()
  async fetchMarketListDebounced({
    categoryId,
    ids,
    sparkline,
  }: {
    categoryId?: string;
    ids?: string;
    sparkline?: boolean;
  }) {
    await this._fetchMarketListDebounced({ categoryId, ids, sparkline });
  }

  @bindThis()
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
    if (categoryId === MARKET_FAVORITES_CATEGORYID && !coingeckoIds) {
      return;
    }
    const vsCurrency = appSelector((s) => s.settings.selectedFiatMoneySymbol);
    const data = await fetchData<MarketTokenItem[]>(
      path,
      {
        category: categoryId,
        vs_currency: vsCurrency ?? 'usd',
        ids: coingeckoIds,
        sparkline,
        sparklinePoints: sparkline ? 100 : undefined,
      },
      [],
    );
    if (data.length === 0) {
      return;
    }
    const categorys = appSelector((s) => s.market.categorys);
    const fetchCategory = categorys[categoryId ?? ''];
    if (
      categoryId === MARKET_FAVORITES_CATEGORYID &&
      fetchCategory &&
      fetchCategory.coingeckoIds?.length !== data.length
    ) {
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
    const data = await fetchData<
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
  async fetchMarketDetail({
    coingeckoId,
    locale,
  }: {
    coingeckoId: string;
    locale: string;
  }) {
    const { appSelector, dispatch } = this.backgroundApi;
    const vsCurrency = appSelector((s) => s.settings.selectedFiatMoneySymbol);
    const path = '/market/detail';
    const data = await fetchData(
      path,
      {
        vs_currency: vsCurrency ?? 'usd',
        id: coingeckoId,
        locale,
        explorer_platforms: true,
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
    const data = await fetchData<{
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
    const data = await fetchData<{ coingeckoId: string } | null>(
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
    const { appSelector, dispatch } = this.backgroundApi;
    const vsCurrency = appSelector((s) => s.settings.selectedFiatMoneySymbol);
    const data = await fetchData(
      path,
      {
        coingeckoId,
        days,
        points,
        vs_currency: vsCurrency ?? 'usd',
      },
      [],
    );
    if (data.length > 0) {
      dispatch(updateMarketChats({ coingeckoId, chart: data, days }));
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
    const data = await fetchData(path, { query: searchKeyword }, []);
    this.backgroundApi.dispatch(
      updateSearchTokens({ searchKeyword, coingeckoIds: data }),
    );
    // updata tokenItem for redux
    if (data.length > 0) {
      this.fetchMarketListDebounced({
        ids: data.join(','),
        sparkline: false,
      });
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
      if (f.symbol) {
        await this.marketTokenAddFavoriteForNtf(f.coingeckoId, f.symbol);
      }
    }
    this.backgroundApi.serviceCloudBackup.requestBackup();
    return simpleDb.market.saveFavoriteMarketTokens(coingeckoIds);
  }

  @backgroundMethod()
  async getTokensDetail(coingeckoIds: string[]) {
    const path = '/market/tokens';
    const ids = coingeckoIds.join(',');
    const data = await fetchData<MarketTokenItem[]>(
      path,
      {
        vs_currency: 'usd',
        ids,
      },
      [],
    );
    return data;
  }

  @backgroundMethod()
  async clearMarketFavoriteTokens() {
    this.backgroundApi.serviceCloudBackup.requestBackup();
    return simpleDb.market.clearRawData();
  }

  @backgroundMethod()
  async cancelMarketFavoriteToken(coingeckoId: string) {
    this.backgroundApi.dispatch(cancleMarketFavorite(coingeckoId));
    this.marketTokenCancelFavoriteForNtf(coingeckoId);
    this.backgroundApi.serviceCloudBackup.requestBackup();
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
