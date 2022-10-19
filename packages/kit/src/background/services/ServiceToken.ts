import { Token } from '@onekeyhq/engine/src/types/token';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  addAccountTokens,
  addNetworkTokens,
  setAccountTokens,
  setAccountTokensBalances,
  setCharts,
  setEnabledNativeTokens,
  setNativeToken,
  setNetworkTokens,
  setPrices,
} from '../../store/reducers/tokens';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase, { IServiceBaseProps } from './ServiceBase';

@backgroundClass()
export default class ServiceToken extends ServiceBase {
  constructor(props: IServiceBaseProps) {
    super(props);
    appEventBus.on(
      AppEventBusNames.NetworkChanged,
      this.refreshTokenBalance.bind(this),
    );
  }

  refreshTokenBalance() {
    const { appSelector } = this.backgroundApi;
    const activeAccountId = appSelector((s) => s.general.activeAccountId);
    const activeNetworkId = appSelector((s) => s.general.activeNetworkId);
    if (activeAccountId && activeNetworkId) {
      this.fetchTokenBalance({ activeAccountId, activeNetworkId });
    }
  }

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
    dispatch(
      setNetworkTokens({
        activeNetworkId,
        tokens: networkTokens,
        keepAutoDetected: true,
      }),
    );
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
  async fetchTokensIfEmpty({ activeNetworkId }: { activeNetworkId: string }) {
    const { appSelector, engine, dispatch } = this.backgroundApi;
    const tokens = appSelector((s) => s.tokens.tokens);
    const networkTokens = tokens[activeNetworkId];
    if (activeNetworkId && (!networkTokens || networkTokens.length === 0)) {
      await engine.getTokens(activeNetworkId);
      const topTokens = await engine.getTopTokensOnNetwork(activeNetworkId, 50);
      dispatch(
        setNetworkTokens({
          activeNetworkId,
          tokens: topTokens,
          keepAutoDetected: true,
        }),
      );
    }
  }

  @backgroundMethod()
  async fetchAccountTokensIfEmpty({
    activeAccountId,
    activeNetworkId,
  }: {
    activeAccountId: string;
    activeNetworkId: string;
  }) {
    const { appSelector } = this.backgroundApi;
    const accountTokens = appSelector((s) => s.tokens.accountTokens);
    const userTokens = accountTokens[activeNetworkId]?.[activeAccountId];
    if (
      activeAccountId &&
      activeNetworkId &&
      (!userTokens || userTokens.length === 0)
    ) {
      await this.fetchAccountTokens({
        activeAccountId,
        activeNetworkId,
        withBalance: true,
        withPrice: true,
      });
    }
  }

  @backgroundMethod()
  async fetchAccountTokens({
    activeAccountId,
    activeNetworkId,
    withBalance,
    withPrice,
    wait,
    forceReloadTokens,
  }: {
    activeAccountId: string;
    activeNetworkId: string;
    withBalance?: boolean;
    withPrice?: boolean;
    wait?: boolean;
    forceReloadTokens?: boolean;
  }) {
    const { engine, dispatch } = this.backgroundApi;
    const tokens = await engine.getTokens(
      activeNetworkId,
      activeAccountId,
      true,
      true,
      forceReloadTokens,
    );
    dispatch(setAccountTokens({ activeAccountId, activeNetworkId, tokens }));
    const nativeToken = tokens.filter((item) => !item.tokenIdOnNetwork)[0];
    if (nativeToken) {
      dispatch(
        setNativeToken({ networkId: activeNetworkId, token: nativeToken }),
      );
    }
    const waitPromises: Promise<any>[] = [];
    if (withBalance) {
      waitPromises.push(
        this.fetchTokenBalance({
          activeAccountId,
          activeNetworkId,
          tokenIds: tokens.map((token) => token.tokenIdOnNetwork),
        }),
      );
    }
    if (withPrice) {
      waitPromises.push(
        this.fetchPrices({
          activeNetworkId,
          activeAccountId,
          tokenIds: tokens.map((token) => token.tokenIdOnNetwork),
        }),
      );
    }
    if (wait) {
      await Promise.all(waitPromises);
    }
    return tokens;
  }

  @backgroundMethod()
  async clearActiveAccountTokenBalance() {
    const { accountId, networkId } = await this.getActiveWalletAccount();
    this.backgroundApi.dispatch(
      setAccountTokensBalances({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        tokensBalance: {},
      }),
    );
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
  }): Promise<Record<string, string | undefined>> {
    const { engine, appSelector, dispatch } = this.backgroundApi;
    const { tokens, accountTokens } = appSelector((s) => s.tokens);
    let tokenIdsOnNetwork: string[] = [];
    if (tokenIds) {
      tokenIdsOnNetwork = tokenIds;
    } else {
      const ids1 = tokens[activeNetworkId] || [];
      const ids2 = accountTokens[activeNetworkId]?.[activeAccountId] || [];
      tokenIdsOnNetwork = ids1.concat(ids2).map((i) => i.tokenIdOnNetwork);
    }
    if (!activeAccountId) {
      return {};
    }
    const [tokensBalance, newTokens] = await engine.getAccountBalance(
      activeAccountId,
      activeNetworkId,
      Array.from(new Set(tokenIdsOnNetwork)),
      true,
    );
    const actions = [];
    if (newTokens?.length) {
      actions.push(
        addAccountTokens({
          activeAccountId,
          activeNetworkId,
          tokens: newTokens,
        }),
      );
      actions.push(
        addNetworkTokens({
          activeNetworkId,
          tokens: newTokens,
        }),
      );
    }
    dispatch(
      ...actions,
      setAccountTokensBalances({
        activeAccountId,
        activeNetworkId,
        tokensBalance,
      }),
    );
    return tokensBalance;
  }

  @backgroundMethod()
  async getPrices({
    networkId,
    tokenIds,
  }: {
    networkId: string;
    tokenIds: string[];
  }) {
    const ids = tokenIds.filter((id) => id !== undefined);
    const { appSelector } = this.backgroundApi;
    const prices = appSelector((s) => s.tokens.tokensPrice)[networkId] || {};
    for (const tokenId of ids) {
      if (!prices[tokenId]) {
        return this.fetchPrices({
          activeNetworkId: networkId,
          tokenIds: ids,
        });
      }
    }
    return prices;
  }

  @backgroundMethod()
  async fetchPrices({
    activeNetworkId,
    activeAccountId,
    tokenIds,
  }: {
    activeNetworkId: string;
    activeAccountId?: string;
    tokenIds?: string[];
  }) {
    const { engine, appSelector, dispatch } = this.backgroundApi;
    const { tokens, accountTokens } = appSelector((s) => s.tokens);
    let tokenIdsOnNetwork: string[] = [];
    if (tokenIds) {
      tokenIdsOnNetwork = tokenIds;
    } else {
      const ids1 = tokens[activeNetworkId] || [];
      const ids2 = activeAccountId
        ? accountTokens[activeNetworkId]?.[activeAccountId] ?? []
        : [];
      tokenIdsOnNetwork = ids1.concat(ids2).map((i) => i.tokenIdOnNetwork);
      tokenIdsOnNetwork = Array.from(new Set(tokenIdsOnNetwork));
    }
    const [prices, charts] = await engine.getPricesAndCharts(
      activeNetworkId,
      tokenIdsOnNetwork,
    );
    const fullPrices: Record<string, string | null> = {
      main: prices.main?.toFixed() || null,
    };
    tokenIdsOnNetwork.forEach((id) => {
      if (prices[id] === undefined) {
        // loading finished but no price for this token
        fullPrices[id] = null;
      } else {
        fullPrices[id] = prices[id].toFixed();
      }
    });

    dispatch(
      setPrices({
        activeNetworkId,
        prices: fullPrices,
      }),
      setCharts({ activeNetworkId, charts }),
    );
    return fullPrices;
  }

  @backgroundMethod()
  async addAccountToken(
    networkId: string,
    accountId: string,
    address: string,
    logoURI?: string,
  ): Promise<Token | undefined> {
    const { engine, appSelector } = this.backgroundApi;
    if (!address) {
      return;
    }
    const accountTokens = appSelector((s) => s.tokens.accountTokens);
    const tokens = accountTokens[networkId]?.[accountId] ?? ([] as Token[]);
    const isExists = tokens.find((item) => item.tokenIdOnNetwork === address);
    if (isExists) {
      return;
    }
    const result = await engine.quickAddToken(
      accountId,
      networkId,
      address,
      logoURI,
    );
    await this.fetchAccountTokens({
      activeAccountId: accountId,
      activeNetworkId: networkId,
    });
    return result;
  }

  @backgroundMethod()
  async getNativeToken(networkId: string) {
    const { appSelector, engine, dispatch } = this.backgroundApi;
    const nativeTokens = appSelector((s) => s.tokens.nativeTokens) ?? {};
    const target = nativeTokens?.[networkId];
    if (target) {
      return target;
    }
    const nativeTokenInfo = await engine.getNativeTokenInfo(networkId);
    dispatch(setNativeToken({ networkId, token: nativeTokenInfo }));
    return nativeTokenInfo;
  }

  @backgroundMethod()
  async getEnabledNativeTokens(options?: {
    forceUpdate: boolean;
  }): Promise<Token[]> {
    const { appSelector, dispatch } = this.backgroundApi;
    const swappableNativeTokens = appSelector(
      (s) => s.tokens.enabledNativeTokens,
    );
    if (
      swappableNativeTokens &&
      swappableNativeTokens.length > 0 &&
      !options?.forceUpdate
    ) {
      return swappableNativeTokens;
    }
    const networks = appSelector((s) => s.runtime.networks);
    const enabledNetworks = networks.filter(
      (item) => !item.isTestnet && item.enabled,
    );
    const items = enabledNetworks.map((item) => this.getNativeToken(item.id));
    const tokens = await Promise.all(items);
    dispatch(setEnabledNativeTokens(tokens));
    return tokens;
  }
}
