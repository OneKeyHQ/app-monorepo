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
  async fetchTokens(balance = true) {
    const { engine, appSelector, dispatch } = this.backgroundApi;
    const { activeAccountId, activeNetworkId } = appSelector(
      (s) => s.general,
    ) as GeneralInitialState;
    if (!activeAccountId || !activeNetworkId) {
      return;
    }
    const topTokens = await engine.getTopTokensOnNetwork(activeNetworkId, 50);
    dispatch(setTokens({ activeNetworkId, tokens: topTokens }));
    if (balance) {
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
    }
    const prices = await engine.getPrices(
      activeNetworkId,
      topTokens.map((i) => i.tokenIdOnNetwork),
      true,
    );
    dispatch(setPrices({ activeNetworkId, prices }));
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
  }

  @backgroundMethod()
  async fetchTokenBalance(tokenIds: string[] = []) {
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
    const tokensBalance = await engine.getAccountBalance(
      activeAccountId,
      activeNetworkId,
      tokenIdsOnNetwork,
      true,
    );
    dispatch(
      setAccountTokensBalances({
        activeAccountId,
        activeNetworkId,
        tokensBalance,
      }),
    );
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
  }
}
