import {
  TokenInitialState,
  setAccountTokens,
  setAccountTokensBalances,
  setPrices,
  setTokens,
} from '../../store/reducers/tokens';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceToken extends ServiceBase {
  @backgroundMethod()
  async fetchTokens({
    activeAccountId,
    activeNetworkId,
    withBalance,
    withPrice,
  }: {
    activeAccountId: string;
    activeNetworkId: string;
    withBalance?: boolean;
    withPrice?: boolean;
  }) {
    const { engine, dispatch } = this.backgroundApi;
    const networkTokens = await engine.getTopTokensOnNetwork(
      activeNetworkId,
      50,
    );
    dispatch(setTokens({ activeNetworkId, tokens: networkTokens }));
    const tokenIds = networkTokens.map((token) => token.tokenIdOnNetwork);
    if (withBalance) {
      this.fetchTokenBalance({
        activeAccountId,
        activeNetworkId,
        tokenIds,
      });
    }
    if (withPrice) {
      this.fetchPrices({
        activeNetworkId,
        activeAccountId,
        tokenIds,
      });
    }
    return networkTokens;
  }

  @backgroundMethod()
  async fetchAccountTokens({
    activeAccountId,
    activeNetworkId,
    withBalance,
    withPrice,
  }: {
    activeAccountId: string;
    activeNetworkId: string;
    withBalance?: boolean;
    withPrice?: boolean;
  }) {
    const { engine, dispatch } = this.backgroundApi;
    const tokens = await engine.getTokens(activeNetworkId, activeAccountId);
    dispatch(setAccountTokens({ activeAccountId, activeNetworkId, tokens }));
    if (withBalance) {
      this.fetchTokenBalance({
        activeAccountId,
        activeNetworkId,
        tokenIds: tokens.map((token) => token.tokenIdOnNetwork),
      });
    }
    if (withPrice) {
      this.fetchPrices({
        activeNetworkId,
        activeAccountId,
        tokenIds: tokens.map((token) => token.tokenIdOnNetwork),
      });
    }
    return tokens;
  }

  @backgroundMethod()
  async fetchTokenBalance({
    activeNetworkId,
    activeAccountId,
    tokenIds,
  }: {
    activeNetworkId: string;
    activeAccountId: string;
    tokenIds?: string[];
  }) {
    const { engine, appSelector, dispatch } = this.backgroundApi;
    const { tokens, accountTokens } = appSelector(
      (s) => s.tokens,
    ) as TokenInitialState;
    let tokenIdsOnNetwork: string[] = [];
    if (tokenIds) {
      tokenIdsOnNetwork = tokenIds;
    } else {
      const ids1 = tokens[activeNetworkId] || [];
      const ids2 = accountTokens[activeNetworkId]?.[activeAccountId] || [];
      tokenIdsOnNetwork = ids1.concat(ids2).map((i) => i.tokenIdOnNetwork);
    }
    const tokensBalance = await engine.getAccountBalance(
      activeAccountId,
      activeNetworkId,
      Array.from(new Set(tokenIdsOnNetwork)),
      true,
    );
    dispatch(
      setAccountTokensBalances({
        activeAccountId,
        activeNetworkId,
        tokensBalance,
      }),
    );
    return tokensBalance;
  }

  @backgroundMethod()
  async fetchPrices({
    activeNetworkId,
    activeAccountId,
    tokenIds,
  }: {
    activeNetworkId: string;
    activeAccountId: string;
    tokenIds?: string[];
  }) {
    const { engine, appSelector, dispatch } = this.backgroundApi;
    const { tokens, accountTokens } = appSelector(
      (s) => s.tokens,
    ) as TokenInitialState;
    let tokenIdsOnNetwork: string[] = [];
    if (tokenIds) {
      tokenIdsOnNetwork = tokenIds;
    } else {
      const ids1 = tokens[activeNetworkId] || [];
      const ids2 = accountTokens[activeNetworkId]?.[activeAccountId] || [];
      tokenIdsOnNetwork = ids1.concat(ids2).map((i) => i.tokenIdOnNetwork);
    }
    const prices = await engine.getPrices(
      activeNetworkId,
      Array.from(new Set(tokenIdsOnNetwork)),
    );
    dispatch(setPrices({ activeNetworkId, prices }));
    return prices;
  }
}
