import { debounce, uniq } from 'lodash';

import { setTokenPriceMap } from '@onekeyhq/kit/src/store/reducers/tokens';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { fetchData } from '@onekeyhq/shared/src/background/backgroundUtils';

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
    const { appSelector, dispatch } = this.backgroundApi;
    const { tokens, accountTokens } = appSelector((s) => s.tokens);
    let tokenIdsOnNetwork: string[] = [];
    if (tokenIds) {
      tokenIdsOnNetwork = tokenIds;
    } else {
      const ids1 = tokens[networkId] || [];
      const ids2 = accountId ? accountTokens[networkId]?.[accountId] ?? [] : [];
      tokenIdsOnNetwork = ids1.concat(ids2).map((i) => i.tokenIdOnNetwork);
      tokenIdsOnNetwork = uniq(tokenIdsOnNetwork);
    }
    const params: PriceQueryParams = {
      vsCurrency,
      platform: networkId,
      contractAddresses: tokenIdsOnNetwork,
    };
    const datas = await this.getCgkTokenPrice(params);
    if (Object.keys(datas).length > 0) {
      dispatch(setTokenPriceMap({ prices: datas }));
    }
    return datas;
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
}
