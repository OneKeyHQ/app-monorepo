import { GeneralInitialState } from '../../store/reducers/general';
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
  async fetchTokens(activeAccountId: string, activeNetworkId: string) {
    const { engine, dispatch } = this.backgroundApi;
    const topTokens = await engine.getTopTokensOnNetwork(activeNetworkId, 50);
    dispatch(setTokens({ activeNetworkId, tokens: topTokens }));
    const tokensBalance = await engine.getAccountBalance(
      activeAccountId,
      activeNetworkId,
      topTokens.map((i) => i.tokenIdOnNetwork),
      true,
    );
    dispatch(
      setAccountTokensBalances({
        activeAccountId,
        activeNetworkId,
        tokensBalance,
      }),
    );
    const prices = await engine.getPrices(
      activeNetworkId,
      topTokens.map((i) => i.tokenIdOnNetwork),
      true,
    );
    dispatch(setPrices({ activeNetworkId, prices }));
    return topTokens;
  }

  @backgroundMethod()
  async fetchAccountTokens(balance = true) {
    const { engine, appSelector, dispatch } = this.backgroundApi;
    const { activeAccountId, activeNetworkId } = appSelector(
      (s) => s.general,
    ) as GeneralInitialState;
    if (!activeAccountId || !activeNetworkId) {
      return;
    }
    const tokens = await engine.getTokens(activeNetworkId, activeAccountId);
    dispatch(setAccountTokens({ activeAccountId, activeNetworkId, tokens }));
    if (balance) {
      const tokensAddresses = tokens
        .filter((i) => i.tokenIdOnNetwork)
        .map((token) => token.tokenIdOnNetwork);

      const balances = await engine.getAccountBalance(
        activeAccountId,
        activeNetworkId,
        tokensAddresses,
        true,
      );
      dispatch(
        setAccountTokensBalances({
          activeAccountId,
          activeNetworkId,
          tokensBalance: balances,
        }),
      );
    }
    const prices = await engine.getPrices(
      activeNetworkId,
      tokens.map((i) => i.tokenIdOnNetwork),
      true,
    );
    dispatch(setPrices({ activeNetworkId, prices }));
    return tokens;
  }

  @backgroundMethod()
  async fetchTokenBalance(
    networkId: string,
    accountId: string,
    tokenIds: string[] = [],
  ) {
    const { engine, appSelector, dispatch } = this.backgroundApi;
    const { tokens, accountTokens } = appSelector(
      (s) => s.tokens,
    ) as TokenInitialState;
    let tokenIdsOnNetwork: string[] = [];
    if (tokenIds.length > 0) {
      tokenIdsOnNetwork = tokenIds;
    } else {
      const ids1 = tokens[networkId] || [];
      const ids2 = accountTokens[networkId]?.[accountId] || [];
      tokenIdsOnNetwork = ids1.concat(ids2).map((i) => i.tokenIdOnNetwork);
    }
    const tokensBalance = await engine.getAccountBalance(
      accountId,
      networkId,
      tokenIdsOnNetwork,
      true,
    );
    dispatch(
      setAccountTokensBalances({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        tokensBalance,
      }),
    );
    return tokensBalance;
  }

  @backgroundMethod()
  async fetchPrices(tokenIds: string[] = []) {
    const { engine, appSelector, dispatch } = this.backgroundApi;
    const { activeAccountId, activeNetworkId } = appSelector(
      (s) => s.general,
    ) as GeneralInitialState;
    if (!activeAccountId || !activeNetworkId) {
      return;
    }
    const { tokens, accountTokens } = appSelector(
      (s) => s.tokens,
    ) as TokenInitialState;
    let tokenIdsOnNetwork: string[] = [];
    if (tokenIds.length > 0) {
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

  @backgroundMethod()
  async fetchAccountTokensWithId(
    activeAccountId: string,
    activeNetworkId: string,
  ) {
    const { engine, dispatch } = this.backgroundApi;
    if (!activeAccountId || !activeNetworkId) {
      return;
    }
    const tokens = await engine.getTokens(activeNetworkId, activeAccountId);
    dispatch(setAccountTokens({ activeAccountId, activeNetworkId, tokens }));
    const tokensAddresses = tokens
      .filter((i) => i.tokenIdOnNetwork)
      .map((token) => token.tokenIdOnNetwork);

    const balances = await engine.getAccountBalance(
      activeAccountId,
      activeNetworkId,
      tokensAddresses,
      true,
    );

    dispatch(
      setAccountTokensBalances({
        activeAccountId,
        activeNetworkId,
        tokensBalance: balances,
      }),
    );
    const prices = await engine.getPrices(
      activeNetworkId,
      tokens.map((i) => i.tokenIdOnNetwork),
      true,
    );
    dispatch(setPrices({ activeNetworkId, prices }));
    return tokens;
  }
}
