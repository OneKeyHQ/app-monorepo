import { debounce, random, uniq, xor } from 'lodash';

import { updateFiatMoneyMap } from '@onekeyhq/kit/src/store/reducers/fiatMoney';
import { updateRefreshHomeOverviewTs } from '@onekeyhq/kit/src/store/reducers/refresher';
import { setSelectedFiatMoneySymbol } from '@onekeyhq/kit/src/store/reducers/settings';
import type { SimpleTokenPrices } from '@onekeyhq/kit/src/store/reducers/tokens';
import { setTokenPriceMap } from '@onekeyhq/kit/src/store/reducers/tokens';
import { EOverviewScanTaskType } from '@onekeyhq/kit/src/views/Overview/types';
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
  @bindThis()
  registerEvents() {
    appEventBus.on(AppEventBusNames.CurrencyChanged, () => {
      const { appSelector } = this.backgroundApi;
      const { activeAccountId: accountId, activeNetworkId: networkId } =
        appSelector((s) => s.general);
      if (!networkId || !accountId) {
        return;
      }
      const accountTokens = appSelector(
        (s) => s.tokens.accountTokens?.[networkId]?.[accountId],
      );
      const currentVsCurrency = appSelector(
        (s) => s.settings.selectedFiatMoneySymbol,
      );
      this.fetchSimpleTokenPrice({
        networkId,
        accountId,
        tokenIds: accountTokens.map((t) => t.tokenIdOnNetwork),
        vsCurrency: currentVsCurrency,
      });
    });
  }

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
      dispatch(
        setTokenPriceMap({ prices: datas, vsCurrency }),
        updateRefreshHomeOverviewTs([EOverviewScanTaskType.token]),
      );
    }
    return datas;
  }

  @backgroundMethod()
  testUpdateTokenPriceMap() {
    const { dispatch } = this.backgroundApi;
    dispatch(
      setTokenPriceMap({
        prices: {
          'evm--1': {
            'usd': random(1800, 2500),
            'usd_24h_change': -0.28172809241920566,
          },
          'evm--1-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
            'usd': random(1800, 2500),
            'usd_24h_change': null,
          },
          'evm--1-0x630fe3adb53f3d2e0c594bc180309fdfdd0a854d': {
            'usd': null,
            'usd_24h_change': null,
          },
          'evm--1-0x7f08c7cc37fe1718017e7900fe63fe7604daf253': {
            'usd': null,
            'usd_24h_change': null,
          },
          'evm--1-0x9d6b29308ff0dd2f0e3115fb08baa0819313834c': {
            'usd': null,
            'usd_24h_change': null,
          },
        },
        vsCurrency: 'usd',
      }),
    );
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
