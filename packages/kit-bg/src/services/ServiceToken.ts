import BigNumber from 'bignumber.js';
import { debounce, isEmpty, uniq, xor } from 'lodash';

import { getBalancesFromApi } from '@onekeyhq/engine/src/apiProxyUtils';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import type { CheckParams } from '@onekeyhq/engine/src/managers/goplus';
import {
  checkSite,
  getAddressRiskyItems,
  getTokenRiskyItems,
} from '@onekeyhq/engine/src/managers/goplus';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import {
  fetchTokenSource,
  fetchTools,
  formatServerToken,
  getBalanceKey,
} from '@onekeyhq/engine/src/managers/token';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { ServerToken, Token } from '@onekeyhq/engine/src/types/token';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';
import {
  setIsPasswordLoadedInVault,
  setTools,
} from '@onekeyhq/kit/src/store/reducers/data';
import { setOverviewPortfolioUpdatedAt } from '@onekeyhq/kit/src/store/reducers/overview';
import type { TokenBalanceValue } from '@onekeyhq/kit/src/store/reducers/tokens';
import {
  setAccountTokens,
  setAccountTokensBalances,
} from '@onekeyhq/kit/src/store/reducers/tokens';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import type { ITokenDetailInfo } from '@onekeyhq/kit/src/views/ManageTokens/types';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { fetchData } from '@onekeyhq/shared/src/background/backgroundUtils';
import { isLightningNetwork } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { isExtensionBackground } from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import ServiceBase from './ServiceBase';

export type IFetchAccountTokensParams = {
  accountId: string;
  networkId: string;
  forceReloadTokens?: boolean;
  includeTop50TokensQuery?: boolean;
};

@backgroundClass()
export default class ServiceToken extends ServiceBase {
  private interval: any;

  @bindThis()
  registerEvents() {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    appEventBus.on(AppEventBusNames.NetworkChanged, () => {
      this.refreshAccountTokens({ includeTop50TokensQuery: true });
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    appEventBus.on(AppEventBusNames.CurrencyChanged, () => {
      this.refreshAccountTokens({ includeTop50TokensQuery: true });
    });

    if (isExtensionBackground) {
      // https://stackoverflow.com/questions/15798516/is-there-an-event-for-when-a-chrome-extension-popup-is-closed
      chrome.runtime.onConnect.addListener((port) => {
        port.onDisconnect.addListener(() => {
          this.stopRefreshAccountTokens();
        });
      });
    }
  }

  @backgroundMethod()
  refreshAccountTokens(options: Partial<IFetchAccountTokensParams> = {}) {
    const { appSelector } = this.backgroundApi;
    const { activeNetworkId, activeAccountId } = appSelector((s) => s.general);
    if (!activeNetworkId || !activeAccountId) {
      return;
    }
    this.fetchAccountTokens({
      ...options,
      accountId: activeAccountId,
      networkId: activeNetworkId,
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  @bindThis()
  @backgroundMethod()
  async startRefreshAccountTokens() {
    if (this.interval) {
      return;
    }
    const { appSelector } = this.backgroundApi;
    const { activeWalletId } = appSelector((s) => s.general);
    const duration =
      activeWalletId === WALLET_TYPE_WATCHING
        ? getTimeDurationMs({ minute: 1 })
        : getTimeDurationMs({
            seconds: 15,
          });
    this.interval = setInterval(() => {
      this.refreshAccountTokens({ includeTop50TokensQuery: false });
    }, duration);

    debugLogger.common.info(`startRefreshAccountTokens`);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  @bindThis()
  @backgroundMethod()
  async stopRefreshAccountTokens() {
    clearInterval(this.interval);
    this.interval = null;
    debugLogger.common.info(`stopRefreshAccountTokens`);
  }

  private _refreshTokenBalanceWithMemo = memoizee(
    async ({
      accountId,
      networkId,
      forceReloadTokens = false,
      includeTop50TokensQuery = false,
    }: IFetchAccountTokensParams) => {
      const { engine, dispatch, servicePrice, appSelector } =
        this.backgroundApi;

      const accountTokensInRedux = appSelector(
        (s) => s.tokens.accountTokens?.[networkId]?.[accountId],
      );

      let accountTokens = await engine.getTokens(
        networkId,
        accountId,
        true,
        true,
        forceReloadTokens,
      );

      if (!accountTokensInRedux?.length) {
        // show default tokens first
        // update token autoDetected tokens async
        dispatch(
          setAccountTokens({
            accountId,
            networkId,
            tokens: accountTokens,
          }),
        );
      } else {
        accountTokens.push(...accountTokensInRedux);
      }

      const { selectedFiatMoneySymbol } = appSelector((s) => s.settings);
      try {
        const [, autodetectedTokens = []] = await this.getAccountTokenBalance({
          accountId,
          networkId,
          tokenIds: accountTokens.map((token) => token.tokenIdOnNetwork),
          withMain: true,
          includeTop50TokensQuery,
        });
        if (autodetectedTokens.length) {
          accountTokens.push(...autodetectedTokens);
        }
      } catch (e) {
        debugLogger.common.error('fetchAccountTokens error', e);
        return accountTokens;
      }
      // check token prices
      servicePrice.fetchSimpleTokenPrice({
        networkId,
        accountId,
        tokenIds: accountTokens.map((t) => t.tokenIdOnNetwork),
        vsCurrency: selectedFiatMoneySymbol,
      });

      const vault = await engine.getVault({
        accountId,
        networkId,
      });
      accountTokens = await Promise.all(
        accountTokens.map(async (token) => {
          let tokenAddress = token.address ?? token.tokenIdOnNetwork;
          if (tokenAddress) {
            try {
              tokenAddress = await vault.validateTokenAddress(tokenAddress);
            } catch (error) {
              debugLogger.common.error('validateTokenAddress error', error);
            }
          }
          return {
            ...token,
            address: tokenAddress,
            tokenIdOnNetwork: tokenAddress,
          };
        }),
      );

      const removedTokens = await simpleDb.token.localTokens.getRemovedTokens(
        accountId,
        networkId,
      );

      dispatch(
        setAccountTokens({
          accountId,
          networkId,
          tokens: accountTokens.filter(
            (t) => !removedTokens.includes(t.address ?? ''),
          ),
        }),
        setOverviewPortfolioUpdatedAt({
          key: `${networkId}___${accountId}`,
          data: {
            updatedAt: Date.now(),
          },
        }),
      );
      return accountTokens;
    },
    {
      promise: true,
      primitive: true,
      max: 50,
      maxAge: getTimeDurationMs({ seconds: 1 }),
      normalizer: ([p]) => `${p.accountId}-${p.networkId}`,
    },
  );

  @bindThis()
  @backgroundMethod()
  async fetchAccountTokens(options: IFetchAccountTokensParams) {
    const { accountId, networkId } = options;

    if (!accountId || !networkId) {
      return [];
    }
    if (!isAccountCompatibleWithNetwork(accountId, networkId)) {
      return [];
    }
    if (isAllNetworks(networkId)) {
      return [];
    }
    return this._refreshTokenBalanceWithMemo(options);
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
    const { dispatch, engine, servicePassword } = this.backgroundApi;

    const vault = await engine.getWalletOnlyVault(networkId, walletId);
    const vaultSettings = await engine.getVaultSettings(networkId);
    const dbNetwork = await engine.dbApi.getNetwork(networkId);
    const dbAccounts = await engine.dbApi.getAccounts(accountIds);

    let balances: Array<BigNumber | undefined>;
    let password;
    let passwordLoadedCallback;

    if (vaultSettings.validationRequired) {
      password = await servicePassword.getPassword();
      passwordLoadedCallback = (isLoaded: boolean) =>
        dispatch(setIsPasswordLoadedInVault(isLoaded));
    }
    try {
      const balancesAddress = await Promise.all(
        dbAccounts.map(async (a) => {
          if (a.type === AccountType.UTXO || isLightningNetwork(a.coinType)) {
            const address = await vault.getFetchBalanceAddress(a);
            return { address, accountId: a.id };
          }
          if (a.type === AccountType.VARIANT) {
            const address = await vault.addressFromBase(a);
            return { address, accountId: a.id };
          }
          return { address: a.address, accountId: a.id };
        }),
      );

      const requests = balancesAddress.map((acc) => ({
        address: acc.address,
        accountId: acc.accountId,
      }));
      balances = await vault.getBalances(
        requests,
        password,
        passwordLoadedCallback,
      );
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
      if (typeof value !== 'undefined' && !Number.isNaN(value)) {
        actions.push(
          setAccountTokensBalances({
            accountId: key,
            networkId,
            tokensBalance: {
              'main': {
                balance: value,
              },
            },
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
    const { engine, appSelector, dispatch } = this.backgroundApi;
    if (!address) {
      return;
    }
    const accountTokens = appSelector((s) => s.tokens.accountTokens);
    const tokens = accountTokens[networkId]?.[accountId] ?? ([] as Token[]);
    const isExists = tokens.find(
      (item) => item.tokenIdOnNetwork === address && !item.autoDetected,
    );
    if (isExists) {
      return;
    }
    const result = await engine.quickAddToken(
      accountId,
      networkId,
      address,
      logoURI,
    );
    if (result) {
      dispatch(
        setAccountTokens({
          networkId,
          accountId,
          tokens: [...tokens, result],
        }),
      );
    }
    return result;
  }

  @backgroundMethod()
  async fetchTokenSource() {
    return fetchTokenSource();
  }

  @backgroundMethod()
  async getTokenRiskyItems(params: CheckParams) {
    return this._getTokenRiskyItemsWithMemo(params);
  }

  _getTokenRiskyItemsWithMemo = memoizee(getTokenRiskyItems, {
    promise: true,
    primitive: true,
    max: 500,
    maxAge: getTimeDurationMs({ day: 1 }),
  });

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

  @backgroundMethod()
  async getAccountBalanceFromServerApi(
    networkId: string,
    accountId: string,
    withMain = true,
  ): Promise<
    [
      Record<string, TokenBalanceValue>,
      Token[] | undefined,
      Record<string, Token>,
    ]
  > {
    const { engine, serviceAccount } = this.backgroundApi;
    const { address: accountAddress, xpub } =
      await serviceAccount.getAcccountAddressWithXpub(accountId, networkId);

    const accountTokens = await engine.getTokens(
      networkId,
      accountId,
      withMain,
      true,
      false,
    );

    const ret: Record<string, TokenBalanceValue> = {};
    const balancesFromApi =
      (await getBalancesFromApi({
        networkId,
        address: accountAddress,
        xpub,
      })) || [];
    const allAccountTokens: Token[] = [];
    const tokens = await this.batchTokenDetail(
      networkId,
      balancesFromApi.map((b) => b.address),
    );
    for (const {
      address,
      balance,
      sendAddress,
      bestBlockNumber: blockHeight,
    } of balancesFromApi) {
      const token = tokens[address];
      if (token) {
        // only record new token balances
        // other token balances still get from RPC for accuracy
        Object.assign(ret, {
          [getBalanceKey({
            address,
            sendAddress,
          })]: {
            balance,
            blockHeight,
          },
        });
        allAccountTokens.push({
          ...token,
          sendAddress,
          autoDetected: !accountTokens.some((t) => t.address === address),
        });
      }
    }
    return [ret, allAccountTokens, tokens];
  }

  async batchTokenDetail(networkId: string, addresses: string[]) {
    const addressMap: Record<string, 1> = addresses.reduce(
      (memo, n) => ({
        ...memo,
        [n]: 1,
      }),
      {},
    );
    const localTokens: Token[] = (
      await this.backgroundApi.engine.getTokens(
        networkId,
        undefined,
        true,
        true,
      )
    ).filter((t) => addressMap[t?.address ?? '']);

    const serverAddress = xor(
      addresses,
      localTokens.map((t) => t.address ?? ''),
    );

    let serverTokens: Token[] = [];
    if (serverAddress.length) {
      serverTokens = (
        await fetchData<ServerToken[]>(
          `/token/detail/batch`,
          {
            networkId,
            addresses: serverAddress,
          },
          [],
          'POST',
        )
      ).map(formatServerToken);
    }

    const result: Record<string, Token> = [
      ...serverTokens,
      ...localTokens,
    ].reduce((sum, n) => {
      sum[n.address ?? ''] = n;
      return sum;
    }, {} as Record<string, Token>);

    const restAddress = xor(
      serverAddress,
      serverTokens.map((t) => t.address),
    );
    const rpcTokens: Token[] = [];
    for (const address of restAddress) {
      const detail = await this.backgroundApi.engine.findToken({
        networkId,
        tokenIdOnNetwork: address ?? '',
      });
      if (detail) {
        result[address ?? ''] = detail;
        rpcTokens.push(detail);
      }
    }
    await simpleDb.token.insertTokens(networkId, [
      ...serverTokens,
      ...rpcTokens,
    ]);
    return result;
  }

  @backgroundMethod()
  async getAccountBalanceFromRpc(
    networkId: string,
    accountId: string,
    tokenIds: string[],
    withMain = true,
    tokensMap: Record<string, Token> = {},
  ): Promise<[Record<string, TokenBalanceValue>, Token[] | undefined]> {
    const { engine, dispatch, serviceNetwork, servicePassword } =
      this.backgroundApi;
    const network = await engine.getNetwork(networkId);
    const vaultSettings = await engine.getVaultSettings(networkId);

    let password;
    let passwordLoadedCallback;

    if (vaultSettings.validationRequired) {
      password = await servicePassword.getPassword();
      passwordLoadedCallback = (isLoaded: boolean) =>
        dispatch(setIsPasswordLoadedInVault(isLoaded));
    }

    const vault = await engine.getVault({ networkId, accountId });
    const status = await serviceNetwork.measureRpcStatus(networkId);
    const blockHeight = String(status?.latestBlock ?? '0');

    const tokensToGet = uniq(tokenIds);
    const ret: Record<string, TokenBalanceValue> = {};
    const balances = await vault.getAccountBalance(
      tokensToGet,
      withMain,
      password,
      passwordLoadedCallback,
    );
    if (withMain && typeof balances[0] !== 'undefined') {
      Object.assign(ret, {
        main: {
          balance: balances[0]
            .div(new BigNumber(10).pow(network.decimals))
            .toFixed(),
          blockHeight,
        },
      });
    }
    const balanceList = balances.slice(withMain ? 1 : 0);
    const details = await this.batchTokenDetail(networkId, tokensToGet);
    const tokens = Object.assign(details, tokensMap);
    for (let i = 0; i < balanceList.length; i += 1) {
      const balance = balanceList[i];
      const tokenAddress = tokensToGet[i];
      const token = tokens[tokenAddress];
      const decimals = token?.decimals;
      if (
        token &&
        typeof decimals !== 'undefined' &&
        typeof balance !== 'undefined'
      ) {
        const bal = balance.div(new BigNumber(10).pow(decimals)).toFixed();
        Object.assign(ret, {
          [getBalanceKey({
            address: tokenAddress,
          })]: {
            balance: bal,
            blockHeight,
          },
        });
      }
    }
    return [ret, undefined];
  }

  @backgroundMethod()
  async getAccountTokenBalance(params: {
    accountId: string;
    networkId: string;
    tokenIds?: string[];
    withMain?: boolean;
    includeTop50TokensQuery?: boolean;
  }): Promise<[Record<string, TokenBalanceValue>, Token[] | undefined]> {
    const { engine, dispatch, appSelector } = this.backgroundApi;
    const {
      accountId,
      networkId,
      tokenIds,
      withMain = true,
      includeTop50TokensQuery = false,
    } = params;

    let serverApiFetchFailed = false;
    let serverBalances: Record<string, TokenBalanceValue> = {};
    let rpcBalances: Record<string, TokenBalanceValue> = {};
    let autodetectedTokens: Token[] = [];
    let tokensMap: Record<string, Token> = {};
    try {
      [serverBalances, autodetectedTokens = [], tokensMap] =
        await this.getAccountBalanceFromServerApi(
          networkId,
          accountId,
          withMain,
        );
    } catch (e) {
      serverApiFetchFailed = true;
      debugLogger.common.error(
        `getAccountBalanceFromServerApi`,
        {
          params: [networkId, accountId],
          message: e instanceof Error ? e.message : e,
        },
        e,
      );
    }
    const accountTokensInRedux =
      appSelector((s) => s.tokens.accountTokens)?.[networkId]?.[accountId] ??
      [];
    const tokens = [...accountTokensInRedux, ...autodetectedTokens];
    if (includeTop50TokensQuery || serverApiFetchFailed) {
      const top50tokens = await engine.getTopTokensOnNetwork(networkId, 50);
      const accountTokensInDB = await engine.getTokens(
        networkId,
        accountId,
        true,
        true,
      );
      tokens.push(...top50tokens, ...accountTokensInDB);
    }
    const tokensToGet = tokens
      .map((t) => t.tokenIdOnNetwork)
      .concat(tokenIds || [])
      .filter(Boolean);

    try {
      [rpcBalances] = await this.getAccountBalanceFromRpc(
        networkId,
        accountId,
        tokensToGet,
        withMain,
        tokensMap,
      );
    } catch (e) {
      debugLogger.http.error(`getAccountBalanceFromRpc Error`, e);
    }
    const balances: Record<string, TokenBalanceValue> = {};
    for (const k of Object.keys({
      ...serverBalances,
      ...rpcBalances,
    })) {
      const rpcValue = rpcBalances[k];
      const serverValue = serverBalances[k];
      if (!serverValue || !rpcValue) {
        Object.assign(balances, {
          [k]: serverValue || rpcValue,
        });
      } else if (!serverValue.blockHeight || !rpcValue.blockHeight) {
        Object.assign(balances, {
          [k]: rpcValue,
        });
      } else {
        const v = new BigNumber(rpcValue.blockHeight).isGreaterThan(
          serverValue.blockHeight,
        )
          ? rpcValue
          : serverValue;
        Object.assign(balances, {
          [k]: v,
        });
      }
    }

    dispatch(
      setAccountTokensBalances({
        accountId,
        networkId,
        tokensBalance: balances,
      }),
    );
    return [balances, autodetectedTokens];
  }

  @backgroundMethod()
  async getMinDepositAmount({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    if (isEmpty(networkId) || isEmpty(accountId)) return 0;

    const { engine } = this.backgroundApi;

    const vault = await engine.getVault({
      accountId,
      networkId,
    });

    return vault.getMinDepositAmount();
  }

  @backgroundMethod()
  async deleteAccountToken({
    accountId,
    networkId,
    address,
    tokenId,
  }: {
    accountId: string;
    networkId: string;
    address: string;
    tokenId: string;
  }) {
    const { dispatch, appSelector, engine } = this.backgroundApi;

    await engine.removeTokenFromAccount(accountId, tokenId);

    const accountTokensInRedux = appSelector(
      (s) => s.tokens.accountTokens?.[networkId]?.[accountId],
    );

    dispatch(
      setAccountTokens({
        accountId,
        networkId,
        tokens: accountTokensInRedux.filter((t) => t.address !== address),
      }),
    );

    return Promise.resolve();
  }

  @backgroundMethod()
  async fetchTokenDetailInfo(params: {
    coingeckoId?: string;
    networkId?: string;
    tokenAddress?: string;
  }): Promise<ITokenDetailInfo> {
    const data = await fetchData<
      | (Omit<ITokenDetailInfo, 'tokens'> & {
          tokens: ServerToken[];
        })
      | undefined
    >('/token/detailInfo', params, undefined);
    return {
      ...data,
      tokens: data?.tokens.map((t) => formatServerToken(t)) ?? [],
    };
  }

  @backgroundMethod()
  async fetchBalanceDetails({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const vault = await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    });
    let password: string | undefined;
    if (vault.settings.validationRequired) {
      password = await this.backgroundApi.servicePassword.getPassword();
    }
    return vault.fetchBalanceDetails({ password });
  }
}
