import { uniq } from 'lodash';

import { setTokenPriceMap } from '../../store/reducers/tokens';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServicePrice extends ServiceBase {
  @backgroundMethod()
  async fetchSimpleTokenPrice({
    networkId,
    accountId,
    tokenIds,
    fetchMain = true,
    vsCurrency = 'usd',
  }: {
    networkId: string;
    accountId?: string;
    tokenIds?: string[];
    fetchMain?: boolean;
    vsCurrency?: string;
  }) {
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
    dispatch(setTokenPriceMap({ networkId, prices: datas }));
    return datas;
  }
}
