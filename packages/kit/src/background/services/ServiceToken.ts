import { debounce } from 'lodash';

import {
  CheckParams,
  checkSite,
  getAddressRiskyItems,
  getTokenRiskyItems,
} from '@onekeyhq/engine/src/managers/goplus';
import {
  fetchTokenSource,
  fetchTools,
} from '@onekeyhq/engine/src/managers/token';
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
  setNativeToken,
  setNetworkTokens,
  setPrices,
} from '../../store/reducers/tokens';
import { backgroundClass, backgroundMethod, bindThis } from '../decorators';

import ServiceBase, { IServiceBaseProps } from './ServiceBase';

export type IFetchAccountTokensParams = {
  activeAccountId: string;
  activeNetworkId: string;
  withBalance?: boolean;
  withPrice?: boolean;
  wait?: boolean;
  forceReloadTokens?: boolean;
};
@backgroundClass()
export default class ServiceToken extends ServiceBase {
  constructor(props: IServiceBaseProps) {
    super(props);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    appEventBus.on(AppEventBusNames.NetworkChanged, this.refreshTokenBalance);
  }

  @bindThis()
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
    const isEmpty = !networkTokens || networkTokens.length === 0;
    const notIncludeNative =
      networkTokens && !networkTokens?.find((item) => !item.tokenIdOnNetwork);
    if (isEmpty || notIncludeNative) {
      await engine.getTokens(activeNetworkId, undefined, true, true, true);
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

  _fetchAccountTokensDebounced = debounce(
    // eslint-disable-next-line @typescript-eslint/unbound-method
    this.fetchAccountTokens,
    600,
    {
      leading: false,
      trailing: true,
    },
  );

  // avoid multiple calling from hooks, and modal animation done
  @backgroundMethod()
  fetchAccountTokensDebounced(params: IFetchAccountTokensParams) {
    this._fetchAccountTokensDebounced(params);
  }

  // TODO performance issue in web
  @bindThis()
  @backgroundMethod()
  async fetchAccountTokens({
    activeAccountId,
    activeNetworkId,
    withBalance,
    withPrice,
    wait,
    forceReloadTokens,
  }: IFetchAccountTokensParams) {
    const { engine, dispatch } = this.backgroundApi;
    const tokens = await engine.getTokens(
      activeNetworkId,
      activeAccountId,
      true,
      true,
      forceReloadTokens,
    );
    const actions: any[] = [
      setAccountTokens({ activeAccountId, activeNetworkId, tokens }),
    ];
    const nativeToken = tokens.filter((item) => !item.tokenIdOnNetwork)[0];
    if (nativeToken) {
      actions.push(
        setNativeToken({
          networkId: activeNetworkId,
          token: nativeToken,
        }),
      );
    }
    dispatch(...actions);
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
    const vsCurrency = appSelector((s) => s.settings.selectedFiatMoneySymbol);
    const [prices, charts] = await engine.getPricesAndCharts(
      activeNetworkId,
      tokenIdsOnNetwork,
      true,
      vsCurrency,
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
  async fetchTokenSource() {
    return fetchTokenSource();
  }

  @backgroundMethod()
  async getTokenRiskyItems(params: CheckParams) {
    return getTokenRiskyItems(params);
  }

  @backgroundMethod()
  async getAddressRiskyItems(params: CheckParams) {
    return getAddressRiskyItems(params);
  }

  @backgroundMethod()
  async getSiteSecurityInfo(url: string) {
    return checkSite(url);
  }

  @backgroundMethod()
  async fetchTools(networkId: string) {
    return fetchTools(networkId);
  }
}
