import { debounce, uniq } from 'lodash';

import { setTokenPriceMap } from '../../store/reducers/tokens';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

type FetchSimpTokenPriceType = {
  networkId: string;
  accountId?: string;
  tokenIds?: string[];
  fetchMain?: boolean;
  vsCurrency?: string;
};

@backgroundClass()
export default class ServicePrice extends ServiceBase {
  @backgroundMethod()
  async fetchSimpleTokenPrice({
    networkId,
    accountId,
    tokenIds,
    fetchMain = true,
    vsCurrency = 'usd',
  }: FetchSimpTokenPriceType) {
    const { appSelector, dispatch, engine } = this.backgroundApi;
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
    const datas = await engine.getPricesFromCgkSimple(
      networkId,
      tokenIdsOnNetwork,
      vsCurrency,
      fetchMain,
    );
    if (Object.keys(datas).length > 0) {
      dispatch(setTokenPriceMap({ networkId, prices: datas }));
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
    if (Object.keys(Object).length > 0) {
      return tokenId
        ? data[tokenId]?.[vsCurrency]
        : data[networkId]?.[vsCurrency];
    }
    return 0;
  }
}
