import BigNumber from 'bignumber.js';
import { debounce } from 'lodash';
import memoizee from 'memoizee';

import { balanceSupprtedNetwork } from '@onekeyhq/engine/src/apiProxyUtils';
import type { CheckParams } from '@onekeyhq/engine/src/managers/goplus';
import {
  checkSite,
  getAddressRiskyItems,
  getTokenRiskyItems,
} from '@onekeyhq/engine/src/managers/goplus';
import {
  fetchTokenSource,
  fetchTools,
} from '@onekeyhq/engine/src/managers/token';
import type { DBVariantAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { setTools } from '@onekeyhq/kit/src/store/reducers/data';
import {
  setAccountTokens,
  setAccountTokensBalances,
  setNativeToken,
  setNetworkTokens,
} from '@onekeyhq/kit/src/store/reducers/tokens';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import ServiceBase from './ServiceBase';

import type { IServiceBaseProps } from './ServiceBase';

export type IFetchAccountTokensParams = {
  activeAccountId: string;
  activeNetworkId: string;
  withBalance?: boolean;
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
  }: {
    activeAccountId: string;
    activeNetworkId: string;
    withBalance?: boolean;
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
    return networkTokens;
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
    wait,
    forceReloadTokens,
  }: IFetchAccountTokensParams) {
    const options = {
      withBalance,
      wait,
    };
    const { engine, dispatch } = this.backgroundApi;
    let tokens = await engine.getTokens(
      activeNetworkId,
      activeAccountId,
      true,
      true,
      forceReloadTokens,
    );
    let autodetectedTokens: Token[] = [];
    const actions: any[] = [];
    const nativeToken = tokens.find(
      (item) => item.isNative || !item.tokenIdOnNetwork,
    );
    if (nativeToken) {
      actions.push(
        setNativeToken({
          networkId: activeNetworkId,
          token: nativeToken,
        }),
      );
    }
    if (balanceSupprtedNetwork.includes(activeNetworkId)) {
      Object.assign(options, {
        withBalance: true,
        wait: true,
      });
    }
    const waitPromises: Promise<any>[] = [];
    if (options.withBalance) {
      waitPromises.push(
        this.fetchTokenBalance({
          activeAccountId,
          activeNetworkId,
          tokenIds: tokens.map((token) => token.tokenIdOnNetwork),
        }).then((res) => {
          autodetectedTokens = res[1] ?? [];
          tokens = tokens.filter(
            (t) => !autodetectedTokens.some((a) => a.address === t.address),
          );
        }),
      );
    }
    if (options.wait) {
      await Promise.all(waitPromises);
    }
    const accountTokens = tokens.concat(autodetectedTokens);
    actions.push(
      setAccountTokens({
        activeAccountId,
        activeNetworkId,
        tokens: accountTokens,
      }),
    );
    dispatch(...actions);
    return accountTokens;
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
  }): Promise<[Record<string, string | undefined>, Token[] | undefined]> {
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
      return [{}, undefined];
    }
    const [tokensBalance, autodetectedTokens] = await engine.getAccountBalance(
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
    return [tokensBalance, autodetectedTokens];
  }

  async _batchFetchAccountBalances({
    walletId,
    networkId,
    accountIds,
  }: {
    walletId: string;
    networkId: string;
    accountIds: string[];
  }) {
    const { dispatch, engine } = this.backgroundApi;

    const vault = await engine.getWalletOnlyVault(networkId, walletId);
    const dbNetwork = await engine.dbApi.getNetwork(networkId);
    const dbAccounts = await engine.dbApi.getAccounts(accountIds);

    let balances: Array<BigNumber | undefined>;
    try {
      const balancesAddress = await Promise.all(
        dbAccounts.map(async (a) => {
          if (a.type === AccountType.UTXO) {
            const address = await vault.getFetchBalanceAddress(a);
            return { address };
          }
          if (a.type === AccountType.VARIANT) {
            let address = (a as unknown as DBVariantAccount).addresses?.[
              networkId
            ];
            if (!address) {
              address = await vault.addressFromBase(a.address);
            }
            return { address };
          }
          return { address: a.address };
        }),
      );
      const requests = balancesAddress.map((acc) => ({ address: acc.address }));
      balances = await vault.getBalances(requests);
    } catch {
      balances = dbAccounts.map(() => undefined);
    }

    const data = dbAccounts.reduce((result, item, index) => {
      const balance = balances[index];
      result[item.id] = balance
        ? balance.div(new BigNumber(10).pow(dbNetwork.decimals)).toFixed()
        : undefined;
      return result;
    }, {} as Record<string, string | undefined>);

    const actions: any[] = [];
    Object.entries(data).forEach(([key, value]) => {
      if (!Number.isNaN(value)) {
        actions.push(
          setAccountTokensBalances({
            activeAccountId: key,
            activeNetworkId: networkId,
            tokensBalance: { 'main': value },
          }),
        );
      }
    });
    if (actions.length > 0) {
      dispatch(...actions);
    }
  }

  batchFetchAccountBalancesDebounce = debounce(
    // eslint-disable-next-line @typescript-eslint/unbound-method
    this._batchFetchAccountBalances,
    600,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  batchFetchAccountBalances({
    walletId,
    networkId,
    accountIds,
  }: {
    walletId: string;
    networkId: string;
    accountIds: string[];
  }) {
    return this.batchFetchAccountBalancesDebounce({
      walletId,
      networkId,
      accountIds,
    });
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
  async getSiteSecurityInfo(url: string, chainId: string) {
    return checkSite(url, chainId);
  }

  @backgroundMethod()
  async fetchTools() {
    const tools = await fetchTools();
    const { dispatch } = this.backgroundApi;
    dispatch(setTools(tools));
  }

  _getAllTokensMapByNetworkId = memoizee(
    async (networkId: string) => {
      const tokens = await this.backgroundApi.engine.getTokens(
        networkId,
        undefined,
        true,
      );
      const tokensMap: Record<string, Token> = tokens.reduce(
        (memo, next) => ({
          ...memo,
          [next.tokenIdOnNetwork]: next,
        }),
        {},
      );
      return tokensMap;
    },
    {
      promise: true,
      primitive: true,
      max: 200,
      maxAge: getTimeDurationMs({
        hour: 1,
      }),
      normalizer: (args) => JSON.stringify(args),
    },
  );

  @backgroundMethod()
  async getAllTokensMapByNetworkId(networkId: string) {
    return this._getAllTokensMapByNetworkId(networkId);
  }
}
