import { debounce, uniq, xor } from 'lodash';

import { updateFiatMoneyMap } from '@onekeyhq/kit/src/store/reducers/fiatMoney';
import { setSelectedFiatMoneySymbol } from '@onekeyhq/kit/src/store/reducers/settings';
import type { SimpleTokenPrices } from '@onekeyhq/kit/src/store/reducers/tokens';
import { setTokenPriceMap } from '@onekeyhq/kit/src/store/reducers/tokens';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { fetchData } from '@onekeyhq/shared/src/background/backgroundUtils';
import { PRICE_EXPIRED_TIME } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import ServiceBase from './ServiceBase';

type FetchSimpTokenPriceType = {
  networkId: string;
  accountId?: string;
  tokenIds?: string[];
  vsCurrency?: string;
};

type PriceQueryParams = {
  coingeckIds?: string[];
  platform?: string;
  vsCurrency?: string;
  contractAddresses?: string[];
};

@backgroundClass()
export default class ServicePrice extends ServiceBase {
  @backgroundMethod()
  async fetchSimpleTokenPrice({
    networkId,
    accountId,
    tokenIds,
    vsCurrency = 'usd',
  }: FetchSimpTokenPriceType) {
    const { appSelector, dispatch, engine } = this.backgroundApi;
    const accountTokens = appSelector(
      (s) => s.tokens.accountTokens?.[networkId]?.[accountId ?? ''] ?? [],
    );
    let tokenIdsOnNetwork: string[] = [];
    if (tokenIds) {
      tokenIdsOnNetwork = tokenIds;
    } else {
      const tokens = await engine.getTopTokensOnNetwork(networkId, 50);
      tokenIdsOnNetwork = uniq(
        tokens.concat(accountTokens).map((t) => t.tokenIdOnNetwork),
      );
    }
    const { cachePrices, cachedTokenIds } = this.getTokenPricesInCache(
      networkId,
      tokenIdsOnNetwork,
      vsCurrency,
    );
    const restTokenIds = xor(cachedTokenIds, tokenIdsOnNetwork);
    if (!restTokenIds.length) {
      return cachePrices;
    }
    const params: PriceQueryParams = {
      vsCurrency,
      platform: networkId,
      contractAddresses: restTokenIds,
    };
    const datas = await this.getCgkTokenPrice(params);
    if (Object.keys(datas).length > 0) {
      dispatch(setTokenPriceMap({ prices: datas, vsCurrency }));
    }
    return datas;
  }

  @bindThis()
  getTokenPricesInCache(
    networkId: string,
    tokenIds: string[],
    vsCurrency: string,
  ) {
    const now = Date.now();
    const { appSelector } = this.backgroundApi;
    const cachedTokenIds = [];
    const cachePrices: Record<string, SimpleTokenPrices> = {};
    const tokenPricesInCache = appSelector((s) => s.tokens.tokenPriceMap ?? {});
    for (const tokenId of tokenIds) {
      const key = tokenId ? `${networkId}-${tokenId}` : networkId;
      const price = tokenPricesInCache?.[key];
      const updatedAt = price?.[`updatedAt--${vsCurrency}`];
      if (
        updatedAt &&
        typeof price[vsCurrency] !== 'undefined' &&
        now - updatedAt <= PRICE_EXPIRED_TIME
      ) {
        cachePrices[key] = price;
        cachedTokenIds.push(tokenId);
      }
    }
    return { cachePrices, cachedTokenIds };
  }

  _fetchSimpleTokenPriceDebounced = debounce(
    // eslint-disable-next-line @typescript-eslint/unbound-method
    this.fetchSimpleTokenPrice,
    600,
    { leading: false, trailing: true },
  );

  @backgroundMethod()
  fetchSimpleTokenPriceDebounced(params: FetchSimpTokenPriceType) {
    this._fetchSimpleTokenPriceDebounced(params);
  }

  @backgroundMethod()
  async getSimpleTokenPrice({
    networkId,
    tokenId,
  }: {
    networkId: string;
    tokenId?: string;
  }) {
    const { appSelector } = this.backgroundApi;
    const priceMap = appSelector((s) => s.tokens.tokenPriceMap);
    const priceId = `${networkId}${tokenId ? `-${tokenId}` : ''}`;
    const vsCurrency = appSelector((s) => s.settings.selectedFiatMoneySymbol);
    if (priceMap?.[priceId] && priceMap[priceId]?.[vsCurrency]) {
      return priceMap[priceId][vsCurrency];
    }
    const params: FetchSimpTokenPriceType = { networkId, vsCurrency };
    if (tokenId) params.tokenIds = [tokenId];
    const data = await this.fetchSimpleTokenPrice(params);
    if (data && Object.keys(data).length > 0) {
      return data[priceId]?.[vsCurrency];
    }
  }

  @backgroundMethod()
  async getSimpleTokenPriceByCgkId(coingeckId: string) {
    const { appSelector } = this.backgroundApi;
    const vsCurrency = appSelector((s) => s.settings.selectedFiatMoneySymbol);
    const data = await this.getCgkTokenPrice({
      vsCurrency,
      coingeckIds: [coingeckId],
    });
    if (data && Object.keys(data).length > 0) {
      return data[coingeckId]?.[vsCurrency];
    }
  }

  @backgroundMethod()
  async getCgkTokenPrice({
    platform,
    contractAddresses,
    coingeckIds,
    vsCurrency = 'usd',
  }: PriceQueryParams) {
    const params: {
      vs_currency: string;
      platform?: string;
      contracts?: string;
      ids?: string;
    } = { vs_currency: vsCurrency };
    if (platform) {
      params.platform = platform;
    }
    if (contractAddresses?.length) {
      const contracts = contractAddresses.filter((address) => address?.length);
      params.contracts = contracts.join(',');
    }
    if (coingeckIds?.length) {
      const ids = coingeckIds.filter((id) => id?.length);
      params.ids = ids.join(',');
    }
    try {
      const data = await fetchData<Record<string, Record<string, number>>>(
        `/simple/price`,
        params,
        {},
      );
      return data;
    } catch {
      return {};
    }
  }

  @backgroundMethod()
  currencyChanged(value: string) {
    const { dispatch, serviceNotification } = this.backgroundApi;
    dispatch(setSelectedFiatMoneySymbol(value));
    appEventBus.emit(AppEventBusNames.CurrencyChanged);
    serviceNotification.syncPushNotificationConfig();
  }

  @backgroundMethod()
  async updateFiatMoneyMap(fiatMoney: Record<string, Record<string, any>>) {
    const { dispatch } = this.backgroundApi;
    dispatch(updateFiatMoneyMap(fiatMoney));

    return Promise.resolve();
  }
}
