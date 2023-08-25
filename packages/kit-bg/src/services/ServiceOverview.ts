import B from 'bignumber.js';
import { cloneDeep, debounce, isNil, isString, pick, uniq } from 'lodash';
import natsort from 'natsort';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  isAllNetworks,
  parseNetworkId,
} from '@onekeyhq/engine/src/managers/network';
import {
  caseSensitiveImpls,
  getBalanceKey,
} from '@onekeyhq/engine/src/managers/token';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Collection, NFTAssetMeta } from '@onekeyhq/engine/src/types/nft';
import { NFTAssetType } from '@onekeyhq/engine/src/types/nft';
import type {
  ITokenFiatValuesInfo,
  Token,
} from '@onekeyhq/engine/src/types/token';
import {
  type IAccountTokenData,
  TokenRiskLevel,
} from '@onekeyhq/engine/src/types/token';
import {
  getReduxAccountTokenBalancesMap,
  getReduxAccountTokensList,
  getReduxSingleTokenBalance,
  getReduxSingleTokenFiatValues,
  getReduxSingleTokenPrice,
  getReduxTokenPricesMap,
} from '@onekeyhq/kit/src/hooks/crossHooks';
import { setNFTPrice } from '@onekeyhq/kit/src/store/reducers/nft';
import type {
  IOverviewPortfolio,
  IOverviewStats,
  IOverviewStatsInfo,
} from '@onekeyhq/kit/src/store/reducers/overview';
import {
  addOverviewPendingTasks,
  removeOverviewPendingTasks,
  updateOverviewStats,
} from '@onekeyhq/kit/src/store/reducers/overview';
import {
  setOverviewAccountIsUpdating,
  setOverviewHomeTokensLoading,
  updateRefreshHomeOverviewTs,
} from '@onekeyhq/kit/src/store/reducers/refresher';
import type {
  IAccountTokensBalanceMap,
  ITokensPricesMap,
} from '@onekeyhq/kit/src/store/reducers/tokens';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import type { ITokenDetailInfo } from '@onekeyhq/kit/src/views/ManageTokens/types';
import type {
  IAccountToken,
  IOverviewQueryTaskItem,
  IOverviewScanTaskItem,
  IOverviewTokenDetailListItem,
  IReduxHooksQueryToken,
  OverviewAllNetworksPortfolioRes,
  OverviewDefiRes,
} from '@onekeyhq/kit/src/views/Overview/types';
import { EOverviewScanTaskType } from '@onekeyhq/kit/src/views/Overview/types';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { fetchData } from '@onekeyhq/shared/src/background/backgroundUtils';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

import type { IServiceBaseProps } from './ServiceBase';

@backgroundClass()
class ServiceOverview extends ServiceBase {
  private interval: any;

  get pendingTaskMap() {
    return this.backgroundApi.appSelector((s) => s.overview.tasks);
  }

  constructor(props: IServiceBaseProps) {
    super(props);
    this.startQueryPendingTasks();
  }

  @bindThis()
  @backgroundMethod()
  startQueryPendingTasks() {
    if (this.interval) {
      return;
    }
    debugLogger.common.info('startQueryPendingTasks');
    this.interval = setInterval(() => {
      this.queryPendingTasks();
    }, getTimeDurationMs({ seconds: 15 }));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  @bindThis()
  @backgroundMethod()
  async stopQueryPendingTasks() {
    clearInterval(this.interval);
    this.interval = null;
    debugLogger.common.info('stopQueryPendingTasks');
  }

  @backgroundMethod()
  async getPenddingTasksByNetworkId({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<IOverviewQueryTaskItem[]> {
    if (!networkId || !accountId) {
      return Promise.resolve([]);
    }
    const dispatchKey = `${networkId}___${accountId}`;
    return Promise.resolve(
      Object.values(this.pendingTaskMap).filter((n) => n.key === dispatchKey),
    );
  }

  @backgroundMethod()
  async queryPendingTasks() {
    const { dispatch, appSelector } = this.backgroundApi;

    const { activeNetworkId: networkId = '', activeAccountId: accountId = '' } =
      appSelector((s) => s.general);

    if (!networkId || !accountId) {
      return;
    }
    const pendingTasksForCurrentNetwork =
      await this.getPenddingTasksByNetworkId({
        networkId,
        accountId,
      });

    if (!pendingTasksForCurrentNetwork?.length) {
      return;
    }

    const dispatchKey = `${networkId}___${accountId}`;

    const results = await fetchData<
      | (OverviewAllNetworksPortfolioRes & {
          pending: IOverviewQueryTaskItem[];
        })
      | null
    >(
      '/overview/query/all',
      {
        tasks: pendingTasksForCurrentNetwork,
      },
      null,
      'POST',
    );
    if (!results) {
      return;
    }
    const { pending } = results;
    const dispatchActions = [];
    for (const scanType of uniq(
      pendingTasksForCurrentNetwork.map((n) => n.scanType),
    )) {
      if (!pending.find((p) => p.scanType === scanType)) {
        const { data, actions } = this.processNftPriceActions({
          networkId,
          accountId,
          results,
        });
        dispatchActions.push(...actions.map((a) => setNFTPrice(a)));
        await simpleDb.accountPortfolios.setAllNetworksPortfolio({
          key: dispatchKey,
          data,
          scanTypes: [scanType],
        });

        dispatchActions.push(updateRefreshHomeOverviewTs([scanType]));
      }
    }

    if (!pending?.length) {
      const taskIdsWillRemove = pendingTasksForCurrentNetwork
        .map((t) => this.getTaksId(t))
        .filter((id) => !pending.find((p) => p.id === id));

      if (taskIdsWillRemove?.length) {
        dispatchActions.push(
          removeOverviewPendingTasks({
            ids: taskIdsWillRemove,
          }),
        );
      }
    }

    dispatch(...dispatchActions);
  }

  processNftPriceActions({
    networkId,
    results,
    accountId,
  }: {
    networkId: string;
    results: OverviewAllNetworksPortfolioRes;
    accountId: string;
  }) {
    const { appSelector } = this.backgroundApi;
    let networkAccountsMap: Record<string, Account[]> = {};
    if (isAllNetworks(networkId)) {
      networkAccountsMap = appSelector(
        (s) => s.overview.allNetworksAccountsMap?.[accountId ?? ''] ?? {},
      );
    }
    const pricesMap: Record<
      string,
      {
        floorPrice: number;
        lastSalePrice: number;
      }
    > = {};
    results.nfts = ((results.nfts || []) as Collection[]).map((item) => {
      let totalPrice = 0;
      item.assets =
        item.assets?.map((asset) => {
          asset.collection.floorPrice = item.floorPrice;
          totalPrice += asset.latestTradePrice ?? 0;
          asset.networkId = item.networkId;
          asset.accountAddress = item.accountAddress;
          return asset;
        }) ?? [];
      item.totalPrice = totalPrice;
      const activeAccountId = isAllNetworks(networkId)
        ? networkAccountsMap[item.networkId ?? '']?.find(
            (a) => a.address === item.accountAddress,
          )?.id
        : accountId;
      const key = `${item.networkId ?? ''}___${activeAccountId ?? ''}`;
      if (!pricesMap[key]) {
        pricesMap[key] = {
          floorPrice: 0,
          lastSalePrice: 0,
        };
      }
      pricesMap[key].lastSalePrice += totalPrice;
      return item;
    });
    return {
      data: results,
      actions: Object.entries(pricesMap)
        .map(([k, price]) => {
          const [nid, aid] = k.split('___');
          if (!nid || !aid) {
            return null;
          }
          return {
            networkId: nid,
            accountId: aid,
            price,
          };
        })
        .filter(Boolean),
    };
  }

  getTaksId({ networkId, address, xpub, scanType }: IOverviewQueryTaskItem) {
    let accountAddress = address;
    const { impl } = parseNetworkId(networkId);
    if (impl && !caseSensitiveImpls.has(impl)) {
      accountAddress = (accountAddress || '').toLowerCase();
    }
    return `${scanType}___${networkId}___${accountAddress}___${xpub ?? ''}`;
  }

  @bindThis()
  addPendingTasks(tasks: IOverviewScanTaskItem[], key?: string) {
    const { dispatch } = this.backgroundApi;
    const pending: IOverviewPortfolio['tasks'] = {};
    for (const s of tasks) {
      for (const scanType of s.scanTypes ?? []) {
        const singleTask = {
          id: '',
          key,
          networkId: s.networkId,
          address: s.address,
          xpub: s.xpub,
          scanType,
        };
        pending[this.getTaksId(singleTask)] = singleTask;
      }
    }
    dispatch(
      addOverviewPendingTasks({
        data: pending,
      }),
    );
  }

  async buildOverviewScanTasks({
    networkId,
    accountId,
    scanTypes = [
      EOverviewScanTaskType.defi,
      EOverviewScanTaskType.token,
      EOverviewScanTaskType.nfts,
    ],
  }: {
    networkId: string;
    accountId: string;
    scanTypes: IOverviewScanTaskItem['scanTypes'];
  }): Promise<IOverviewScanTaskItem[]> {
    const { serviceAccount, appSelector } = this.backgroundApi;
    if (!isAllNetworks(networkId)) {
      const { address, xpub } = await serviceAccount.getAcccountAddressWithXpub(
        accountId,
        networkId,
      );
      return [
        {
          networkId,
          address,
          xpub,
          scanTypes,
        },
      ];
    }

    const networkAccountsMap = appSelector(
      (s) => s.overview.allNetworksAccountsMap?.[accountId] ?? {},
    );

    const tasks: IOverviewScanTaskItem[] = [];

    for (const [nid, accounts] of Object.entries(networkAccountsMap)) {
      for (const account of accounts) {
        const { address, xpub } = account;
        tasks.push({
          networkId: nid,
          address,
          xpub,
          scanTypes,
        });
      }
    }
    return tasks;
  }

  @backgroundMethod()
  fetchAccountOverviewDebounced(options: {
    networkId: string;
    accountId: string;
    scanTypes?: IOverviewScanTaskItem['scanTypes'];
  }) {
    return this._fetchAccountOverviewDebounced(options);
  }

  // eslint-disable-next-line @typescript-eslint/unbound-method
  _fetchAccountOverviewDebounced = debounce(this.fetchAccountOverview, 600, {
    leading: false,
    trailing: true,
  });

  @bindThis()
  @backgroundMethod()
  async fetchAccountOverview({
    networkId,
    accountId,
    scanTypes,
  }: {
    networkId: string;
    accountId: string;
    scanTypes?: IOverviewScanTaskItem['scanTypes'];
  }) {
    const tasks = await this.buildOverviewScanTasks({
      networkId,
      accountId,
      scanTypes,
    });
    if (!tasks.length) {
      return;
    }
    debugLogger.allNetworks.info('subscribe overview tasks=', tasks);
    const res = await fetchData<{
      tasks?: IOverviewScanTaskItem[];
    }>(
      '/overview/subscribe',
      {
        tasks,
      },
      {},
      'POST',
    );
    if (res.tasks) {
      this.addPendingTasks(tasks, `${networkId}___${accountId}`);
    }
    return res;
  }

  @backgroundMethod()
  async refreshAccountAssets({
    networkId,
    accountId,
    walletId,
  }: {
    networkId: string;
    accountId: string;
    walletId: string | null;
  }) {
    const { engine, serviceToken } = this.backgroundApi;
    if (!networkId || !accountId || !walletId) {
      return;
    }

    const scanTypes = [EOverviewScanTaskType.defi, EOverviewScanTaskType.nfts];
    if (!isAllNetworks(networkId)) {
      engine.clearPriceCache();
      await serviceToken.fetchAccountTokens({
        accountId,
        networkId,
        forceReloadTokens: true,
        includeTop50TokensQuery: true,
        refreshHomeOverviewTs: false,
      });
    } else {
      scanTypes.push(EOverviewScanTaskType.token);
    }

    await this.fetchAccountOverview({
      networkId,
      accountId,
      scanTypes,
    });
  }

  async refreshCurrentAccountNow() {
    const { appSelector, dispatch } = this.backgroundApi;
    const {
      activeAccountId: accountId,
      activeNetworkId: networkId,
      activeWalletId: walletId,
    } = appSelector((s) => s.general);
    const loading = appSelector((s) =>
      accountId ? s.refresher?.overviewHomeTokensLoading : false,
    );
    if (!accountId || !networkId) {
      return;
    }
    if (loading) {
      return;
    }

    dispatch(
      setOverviewHomeTokensLoading(true),
      setOverviewAccountIsUpdating({
        accountId,
        data: true,
      }),
    );
    try {
      await this.refreshAccountAssets({
        networkId,
        accountId,
        walletId,
      });
    } finally {
      dispatch(
        updateRefreshHomeOverviewTs([
          EOverviewScanTaskType.token,
          EOverviewScanTaskType.defi,
          EOverviewScanTaskType.nfts,
        ]),
        setOverviewHomeTokensLoading(false),
        setOverviewAccountIsUpdating({
          accountId,
          data: false,
        }),
      );
    }
  }

  refreshCurrentAccountWithDebounce = debounce(
    () => this.refreshCurrentAccountNow(),
    getTimeDurationMs({ seconds: 1 }),
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  async refreshCurrentAccount({
    debounceEnabled = true,
  }: { debounceEnabled?: boolean } = {}) {
    if (debounceEnabled) {
      const result = await this.refreshCurrentAccountWithDebounce();
      return Promise.resolve(result);
    }
    return this.refreshCurrentAccountNow();
  }

  @backgroundMethod()
  async getAccountPortfolio({
    accountId,
    networkId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<OverviewAllNetworksPortfolioRes> {
    return simpleDb.accountPortfolios.getPortfolio({
      networkId,
      accountId,
    });
  }

  getTokensPrices() {
    const prices = getReduxTokenPricesMap();
    return { prices };
  }

  @backgroundMethod()
  async getValuesInfoOfTokenAsync(
    options: Parameters<typeof this.getValuesInfoOfToken>[0],
  ) {
    return Promise.resolve(this.getValuesInfoOfToken(options));
  }

  getValuesInfoOfToken({
    token,
    prices,
    balances,
  }: {
    token: IReduxHooksQueryToken;
    prices: ITokensPricesMap;
    balances: IAccountTokensBalanceMap;
  }) {
    const priceInfo = this.getPriceOfToken({
      token,
      prices,
    });
    const balanceInfo = this.getBalanceOfToken({
      token,
      balances,
    });
    const valuesInfo: ITokenFiatValuesInfo = getReduxSingleTokenFiatValues({
      priceInfo,
      balanceInfo,
      token,
    });
    return valuesInfo;
  }

  @backgroundMethod()
  async getBalanceOfTokenAsync(
    options: Parameters<typeof this.getBalanceOfToken>[0],
  ) {
    return Promise.resolve(this.getBalanceOfToken(options));
  }

  getBalanceOfToken({
    token,
    balances,
  }: {
    token: IReduxHooksQueryToken;
    balances: IAccountTokensBalanceMap;
  }) {
    return getReduxSingleTokenBalance({
      token,
      balances,
    });
  }

  @backgroundMethod()
  async getPriceOfTokenAsync(
    options: Parameters<typeof this.getPriceOfToken>[0],
  ) {
    return Promise.resolve(this.getPriceOfToken(options));
  }

  getPriceOfToken({
    prices,
    token,
  }: {
    token: IReduxHooksQueryToken;
    prices: ITokensPricesMap;
  }) {
    return getReduxSingleTokenPrice({
      prices,
      token,
    });
  }

  getAccountTokensBalances(options: { networkId: string; accountId: string }) {
    const { networkId, accountId } = options;
    const balances = getReduxAccountTokenBalancesMap({
      networkId,
      accountId,
    });
    return {
      balances,
    };
  }

  buildTokenKey({
    networkId,
    accountId,
    token,
  }: {
    networkId: string;
    accountId: string;
    token: IAccountToken | IAccountTokenData;
  }) {
    return `${networkId}__${accountId}__${token.address ?? ''}__${
      token.sendAddress ?? ''
    }`;
  }

  filterAccountTokenPredicate({
    token,
    tokensFilter,
  }: {
    token: IAccountTokenData | IAccountToken;
    tokensFilter?: IAccountTokensFilter;
  }) {
    if (!tokensFilter) {
      return true;
    }
    const { hideRiskTokens, hideSmallBalance } = tokensFilter;
    if (
      hideSmallBalance &&
      !token.isNative &&
      !isNil(token.usdValue) &&
      new B(token.usdValue).isLessThan(
        isString(hideSmallBalance) ? hideSmallBalance : '1',
      )
    ) {
      return false;
    }
    if (
      hideRiskTokens &&
      token.riskLevel &&
      token.riskLevel > TokenRiskLevel.WARN
    ) {
      return false;
    }
    return true;
  }

  @backgroundMethod()
  sortTokens<T extends IAccountToken | IAccountTokenData>(
    tokens: T[],
    options: IAccountOverviewOptions,
  ): T[] {
    const { tokensSort } = options;
    if (!tokensSort) {
      return tokens;
    }
    const { name, native, value, price } = tokensSort;
    const tokensReturn = tokens.sort((a, b) => {
      let condition = 0;
      // putMainTokenOnTop
      if (native) {
        condition = condition || (b.isNative ? 1 : 0) || (a.isNative ? -1 : 0);
      }
      // TODO asc support
      if (value === 'desc') {
        condition = condition || new B(b.value ?? 0).comparedTo(a.value ?? 0);
      }
      if (price === 'desc') {
        condition = condition || new B(b.price ?? 0).comparedTo(a.price ?? 0);
      }
      if (name === 'asc') {
        condition = condition || natsort({ insensitive: true })(a.name, b.name);
      }
      return condition;
    });

    return tokensReturn;
  }

  @backgroundMethod()
  limitTokens<T extends IAccountToken | IAccountTokenData>(
    tokens: T[],
    options: IAccountOverviewOptions,
  ): T[] {
    const { tokensLimit } = options;
    if (!isNil(tokensLimit)) {
      return tokens.slice(0, tokensLimit);
    }
    return tokens;
  }

  @backgroundMethod()
  buildTokensMapKey<T extends IAccountToken | IAccountTokenData>(
    tokens: T[],
    options: IAccountOverviewOptions,
  ): string[] | undefined {
    const { buildTokensMapKey } = options;
    // * build map key
    if (buildTokensMapKey) {
      return tokens.map((token) => {
        const key = (token as IAccountToken)?.key;
        if (!key) {
          throw new Error('buildTokensMapKey ERROR: key is undefined');
        }
        return key;
      });
    }
    return undefined;
  }

  @backgroundMethod()
  async buildSingleChainAccountTokens<T = IAccountToken>(
    options: IAccountOverviewOptions,
    tokenSchema: IOverviewTokenSchema,
  ): Promise<IOverviewAccountTokensResult<T>> {
    const {
      accountId,
      networkId,
      tokensFilter,
      tokensSort,
      calculateTokensTotalValue,
    } = options;
    // IAccountTokenOnChain, IAccountTokenData
    const tokens: IAccountTokenData[] = getReduxAccountTokensList({
      networkId,
      accountId,
    });

    let balances: IAccountTokensBalanceMap | undefined;
    let prices: ITokensPricesMap | undefined;

    if (tokensSort || calculateTokensTotalValue) {
      ({ prices } = this.getTokensPrices());
      ({ balances } = this.getAccountTokensBalances(options));
    }

    let totalValue: string | undefined;
    let totalValue24h: string | undefined;

    let accValue = new B(0);
    let accValue24h = new B(0);

    // * convert to custom token schema
    let tokensReturn: Array<IAccountToken | IAccountTokenData> = [];
    tokens.forEach((token) => {
      let valuesInfo: ITokenFiatValuesInfo = {};
      if (!isNil(prices) && !isNil(balances)) {
        // * calculate single token value (in USD)
        valuesInfo = this.getValuesInfoOfToken({
          token,
          balances,
          prices,
        });
      }
      const isNative =
        (token.isNative || !token.address) && !isAllNetworks(networkId);
      const t: IAccountTokenData = {
        ...token,
        ...valuesInfo,
        // @ts-ignore
        key: this.buildTokenKey({
          networkId,
          accountId,
          token,
        }),
        isNative,
      };
      // * filter tokens
      const isTokenRemains = this.filterAccountTokenPredicate({
        token: t,
        tokensFilter,
      });
      if (!isTokenRemains) {
        return;
      }

      // * calculate total value (in USD)
      if (calculateTokensTotalValue) {
        accValue = accValue.plus(t.value ?? 0);
        accValue24h = accValue24h.plus(t.value24h ?? 0);
      }

      if (tokenSchema === 'overview') {
        const tokenOverview: IAccountToken = {
          networkId,
          accountId,
          name: t.name,
          symbol: t.symbol,
          address: t.address,
          logoURI: t.logoURI,
          balance: t.balance,
          availableBalance: t.availableBalance,
          transferBalance: t.transferBalance,
          usdValue: t.usdValue,
          value: t.usdValue,
          value24h: undefined,
          price: t.price,
          price24h: t.price24h,
          isNative: t.isNative,
          riskLevel: t.riskLevel,
          key: this.buildTokenKey({
            networkId,
            accountId,
            token: t,
          }),
          coingeckoId: t.coingeckoId,
          sendAddress: t.sendAddress,
          autoDetected: t.autoDetected,
          tokens: [
            {
              networkId: t.networkId,
              address: t.address ?? '',
              balance: t.balance,
              decimals: t.decimals,
              riskLevel: t.riskLevel ?? TokenRiskLevel.UNKNOWN,
              value: t.value,
            },
          ],
        };
        tokensReturn.push(tokenOverview);
      } else {
        tokensReturn.push(t);
      }
    });

    // * calculate total value (in USD)
    if (calculateTokensTotalValue) {
      totalValue = accValue.toFixed(3);
      totalValue24h = accValue24h.toFixed(3);
    }

    // * calculate total before limit
    const tokensTotal = tokensReturn.length;

    tokensReturn = this.sortTokens(tokensReturn, options);

    tokensReturn = this.limitTokens(tokensReturn, options);

    const tokensKeys = this.buildTokensMapKey(tokensReturn, options);

    return Promise.resolve({
      tokensKeys,
      tokens: tokensReturn as T[],
      tokensTotal,
      tokensTotalValue: totalValue,
      tokensTotalValue24h: totalValue24h,
    });
  }

  async buildAllNetworksAccountTokens(
    options: IAccountOverviewOptions,
  ): Promise<
    IOverviewAccountTokensResult & {
      tokens: unknown;
    }
  > {
    const { networkId, accountId, tokensFilter, calculateTokensTotalValue } =
      options;
    const data = await this.getAccountPortfolio({
      networkId,
      accountId,
    });

    let totalValue = new B(0);
    let totalValue24h = new B(0);

    let tokensReturn: Array<IAccountToken> = [];

    (data[EOverviewScanTaskType.token] ?? []).forEach((t) => {
      const value = new B(t.value ?? '0');
      const value24h = new B(t.value24h ?? '0');

      if (calculateTokensTotalValue) {
        totalValue = totalValue.plus(value);
        totalValue24h = totalValue24h.plus(value24h);
      }

      const tokenOverview: IAccountToken = {
        networkId,
        accountId,
        name: t.name,
        symbol: t.symbol,
        address: undefined,
        logoURI: t.logoURI,
        balance: t.balance,
        usdValue: t.value ?? '0',
        value: value.toFixed(3),
        value24h: value24h.toFixed(3),
        price: new B(t.price ?? 0).toNumber(),
        price24h: t.price24h,
        isNative: false,
        riskLevel: TokenRiskLevel.UNKNOWN,
        key: t.coingeckoId,
        coingeckoId: t.coingeckoId,
        sendAddress: undefined,
        autoDetected: false,
        tokens: t.tokens ?? [],
      };

      // * filter tokens
      const isTokenRemains = this.filterAccountTokenPredicate({
        token: tokenOverview,
        tokensFilter,
      });

      if (!isTokenRemains) {
        return;
      }

      tokensReturn.push(tokenOverview);
    });

    // * calculate total before limit
    const tokensTotal = tokensReturn.length;

    tokensReturn = this.sortTokens(tokensReturn, options);
    tokensReturn = this.limitTokens(tokensReturn, options);
    const tokensKeys = this.buildTokensMapKey(tokensReturn, options);

    return {
      tokensKeys,
      tokens: tokensReturn,
      tokensTotal,
      tokensTotalValue: totalValue.toFixed(3),
      tokensTotalValue24h: totalValue24h.toFixed(3),
    };
  }

  refreshOverviewStats({
    networkId,
    accountId,
    tokens,
    defis,
    nfts,
  }: {
    networkId: string;
    accountId: string;
    tokens?: IOverviewStatsInfo;
    defis?: IOverviewStatsInfo;
    nfts?: IOverviewStatsInfo;
  }) {
    const stats: IOverviewStats = cloneDeep(
      this.backgroundApi.appSelector(
        (s) => s.overview.overviewStats?.[networkId]?.[accountId],
      ) ?? {},
    );

    if (tokens) {
      stats.tokens = tokens;
    }
    if (defis) {
      stats.defis = defis;
    }
    if (nfts) {
      stats.nfts = nfts;
    }
    const totalValue = new B(0)
      .plus(stats.tokens?.totalValue ?? 0)
      .plus(stats.defis?.totalValue ?? 0)
      .plus(stats.nfts?.totalValue ?? 0)
      .toFixed(3);
    const totalValue24h = new B(0)
      .plus(stats.tokens?.totalValue24h ?? 0)
      .plus(stats.defis?.totalValue24h ?? 0)
      .plus(stats.nfts?.totalValue24h ?? 0)
      .toFixed(3);
    const shareTokens = new B(stats.tokens?.totalValue ?? 0)
      .div(totalValue)
      .toFixed(3);
    const shareDefis = new B(stats.defis?.totalValue ?? 0)
      .div(totalValue)
      .toFixed(3);
    const shareNfts = new B(stats.nfts?.totalValue ?? 0)
      .div(totalValue)
      .toFixed(3);

    stats.summary = {
      totalValue,
      totalValue24h,
      shareDefis,
      shareNfts,
      shareTokens,
    };

    this.backgroundApi.dispatch(
      updateOverviewStats({ networkId, accountId, stats }),
    );

    return stats;
  }

  @backgroundMethod()
  async buildAccountDefiList(options: {
    networkId: string;
    accountId: string;
    limitSize?: number;
  }): Promise<IOverviewAccountdefisResult> {
    debugLogger.allNetworks.info('buildAccountDefiList >>> ', options);
    const data = await this.getAccountPortfolio(options);

    let list = data[EOverviewScanTaskType.defi] ?? [];

    let defiTotalValue = new B(0);
    let defiTotalValue24h = new B(0);
    const defiValuesMap: IOverviewAccountdefisResult['defiValuesMap'] = {};
    const defiKeys: string[] = [];

    list.forEach((d) => {
      if (d.protocolValue) {
        defiTotalValue = defiTotalValue.plus(d.protocolValue);
      }
      if (d.protocolValue24h) {
        defiTotalValue24h = defiTotalValue24h.plus(d.protocolValue24h);
      }
      const key = `${d._id.networkId}_${d._id.address}_${d._id.protocolId}`;
      defiKeys.push(key);
      defiValuesMap[key] = {
        value: d.protocolValue,
        claimable: d.claimableValue,
      };
    });

    if (typeof options.limitSize === 'number') {
      list = list.slice(0, options.limitSize);
    }

    const totalValue = defiTotalValue.toFixed(3);
    const totalValue24h = defiTotalValue24h.toFixed(3);

    this.refreshOverviewStats({
      networkId: options.networkId,
      accountId: options.accountId,
      defis: {
        totalCounts: list.length,
        totalValue,
        totalValue24h,
      },
    });

    return {
      defiKeys,
      defiValuesMap,
      defis: list,
    };
  }

  @backgroundMethod()
  async buildAccountNFTList(options: { networkId: string; accountId: string }) {
    const { networkId, accountId } = options;
    const { serviceNFT, appSelector } = this.backgroundApi;

    debugLogger.allNetworks.info('buildAccountNFTList >>> ', options);
    const nfts = await serviceNFT.getNftListWithAssetType(options);

    const { prices } = this.getTokensPrices();

    const networkAccountsMap =
      appSelector((s) => s.overview.allNetworksAccountsMap)?.[
        options.accountId
      ] || {};

    const nftPrices = appSelector((s) => s.nft.nftPrice);

    const disPlayPriceType = appSelector((s) => s.nft.disPlayPriceType);

    let totalValue = new B(0);

    if (!isAllNetworks(networkId)) {
      const p = new B(prices?.[networkId ?? '']?.usd ?? 0);
      const v =
        nftPrices[accountId ?? '']?.[networkId ?? '']?.[disPlayPriceType] ?? 0;
      totalValue = p.multipliedBy(v);
    } else {
      for (const [nid, accounts] of Object.entries(networkAccountsMap ?? {})) {
        const p = new B(prices?.[nid]?.usd ?? 0);
        for (const a of accounts) {
          const nftPrice = nftPrices?.[a.id]?.[nid]?.[disPlayPriceType] ?? 0;
          totalValue = totalValue.plus(p.multipliedBy(nftPrice));
        }
      }
    }

    const nftKeys = nfts
      .map((n) => {
        switch (n.type) {
          case NFTAssetType.BTC:
            return n.data.map(
              (d) =>
                `${d.networkId ?? ''}_${d.accountAddress ?? ''}_${
                  d.inscription_id
                }`,
            );
          case NFTAssetType.EVM:
          case NFTAssetType.SOL:
            return n.data.map((d) => {
              const key = `${d.networkId ?? ''}_${d.accountAddress ?? ''}`;
              const assetsKey = d.assets
                .map(
                  (a) =>
                    `${a.tokenAddress ?? ''}_${a.contractAddress ?? ''}_${
                      a.tokenId ?? ''
                    }_${a.latestTradePrice ?? ''}`,
                )
                .join(',');
              return key + assetsKey;
            });
          default:
            return '';
        }
      })
      .flat();

    this.refreshOverviewStats({
      networkId,
      accountId,
      nfts: {
        totalCounts: nfts.length,
        totalValue: new B(totalValue).toFixed(3),
        totalValue24h: undefined,
      },
    });

    return {
      nfts,
      nftKeys,
    };
  }

  // this method only build data from DB, not fetch data from server
  // fetch data logic here: refreshCurrentAccount()
  @backgroundMethod()
  async buildAccountTokens(
    options: IAccountOverviewOptions,
  ): Promise<IOverviewAccountTokensResult> {
    debugLogger.allNetworks.info('buildAccountTokens >>> ', options);
    const { networkId, accountId } = options;
    // build tokens
    const tokenRes = isAllNetworks(networkId)
      ? await this.buildAllNetworksAccountTokens(options)
      : await this.buildSingleChainAccountTokens(options, 'overview');

    if (options.calculateTokensTotalValue) {
      this.refreshOverviewStats({
        networkId,
        accountId,
        tokens: {
          totalCounts: tokenRes.tokensTotal,
          totalValue: tokenRes.tokensTotalValue,
          totalValue24h: tokenRes.tokensTotalValue24h,
        },
      });
    }

    return tokenRes;
  }

  @backgroundMethod()
  async getKeleStakingBalance({
    networkId,
    accountId,
    coingeckoId,
    tokenAddress,
  }: IBuildTokenPositionInfoOptions) {
    const { serviceStaking } = this.backgroundApi;
    const zero = new B(0);
    if (
      isAllNetworks(networkId) ||
      coingeckoId !== 'ethereum' ||
      tokenAddress
    ) {
      return zero;
    }
    const minerOverview = await serviceStaking.fetchMinerOverview({
      networkId,
      accountId,
    });

    if (!minerOverview) {
      return zero;
    }

    return new B(minerOverview?.amount?.total_amount ?? 0).plus(
      minerOverview?.amount.withdrawable ?? 0,
    );
  }

  @backgroundMethod()
  async buildTokenDetailInfo(
    options: IBuildTokenPositionInfoOptions,
  ): Promise<ITokenDetailInfo> {
    debugLogger.allNetworks.info('buildTokenDetailInfo >>> ', options);
    const { engine, serviceToken } = this.backgroundApi;
    const { networkId, accountId, tokenAddress, coingeckoId } = options;
    let chainToken: Token | undefined;
    if (!isAllNetworks(networkId)) {
      chainToken = await engine.findToken({
        networkId,
        tokenIdOnNetwork: tokenAddress ?? '',
      });
    }

    const detailInfo = await serviceToken.fetchTokenDetailInfo({
      coingeckoId,
      networkId,
      tokenAddress,
      accountId,
    });

    const { defaultChain } = detailInfo ?? {};

    const tokens = detailInfo?.tokens ?? [];

    if (!tokens?.length && chainToken) {
      tokens.push(chainToken);
    }

    const defaultToken =
      tokens?.find(
        (t) =>
          t.impl === defaultChain?.impl && t.chainId === defaultChain?.chainId,
      ) ?? tokens?.[0];

    const ethereumNativeToken = tokens?.find(
      (n) =>
        n.impl === IMPL_EVM &&
        (n.chainId === '1' || n.chainId === '5') &&
        (n.isNative || !n.address),
    );

    return {
      ...pick(chainToken, 'name', 'symbol', 'logoURI'),
      ...detailInfo,
      tokens,
      defaultToken,
      ethereumNativeToken,
    };
  }

  @backgroundMethod()
  async buildTokenDetailPositionInfo(options: IBuildTokenPositionInfoOptions) {
    debugLogger.allNetworks.info('buildTokenDetailPositionInfo >>> ', options);
    const { appSelector } = this.backgroundApi;

    const { accountId, networkId, coingeckoId, sendAddress, tokenAddress } =
      options;
    const { defis } = await this.buildAccountDefiList({
      accountId,
      networkId,
    });
    const { tokens } = await this.buildAccountTokens({
      accountId,
      networkId,
      tokensFilter: {
        hideRiskTokens: false,
        hideSmallBalance: false,
      },
      tokensSort: {
        native: true,
      },
      calculateTokensTotalValue: false,
    });
    const accounts = appSelector(
      (s) => s.overview.allNetworksAccountsMap?.[accountId]?.[networkId],
    );

    const balances = appSelector(
      (s) => s.tokens.accountTokensBalance?.[networkId]?.[accountId],
    );

    const keleStakingBalance = await this.getKeleStakingBalance(options);

    const detailInfo = await this.buildTokenDetailInfo(options);

    const items: IOverviewTokenDetailListItem[] = [];

    let totalBalance = keleStakingBalance;

    tokens.forEach((t) => {
      if (
        isAllNetworks(networkId)
          ? coingeckoId === t.coingeckoId
          : t.address === tokenAddress && t.sendAddress === sendAddress
      ) {
        t.tokens?.forEach((item) => {
          const account = accounts?.find(
            (a) => a.address === item.accountAddress,
          );
          if (new B(item.balance ?? 0).isGreaterThan(0)) {
            items.push({
              name: t.name,
              address: t.address,
              symbol: t.symbol,
              logoURI: t.logoURI ?? '',
              type: 'Token',
              balance:
                item.balance ?? balances[getBalanceKey(t)]?.balance ?? '0',
              networkId: item.networkId,
              accountName: account?.name ?? '',
            });
          }
        });
        totalBalance = totalBalance.plus(t.balance ?? 0);
      }
    });

    defis.forEach((d) => {
      d.pools.forEach((p) => {
        p[1].forEach((item) => {
          [...item.supplyTokens, ...item.rewardTokens].forEach((t) => {
            if (
              isAllNetworks(networkId)
                ? coingeckoId === t.coingeckoId
                : t.tokenAddress === tokenAddress
            ) {
              items.push({
                name: d.protocolName,
                symbol: t.symbol ?? '',
                address: t.tokenAddress,
                logoURI: d.protocolIcon,
                type: p[0],
                balance: t.balanceParsed ?? '0',
                networkId: d._id.networkId,
                poolCode: item.poolCode,
                protocol: d,
              });
              totalBalance = totalBalance.plus(t.balanceParsed ?? 0);
            }
          });
        });
      });
    });

    return {
      items,
      detailInfo,
      totalBalance: totalBalance.toFixed(),
      keleStakingBalance: keleStakingBalance.toFixed(),
    };
  }
}

interface IOverviewTokenSchemaMap {
  'raw': IAccountToken[];
  'overview': IAccountToken;
}

type IOverviewTokenSchema = keyof IOverviewTokenSchemaMap;
export type IOverviewAccountTokensResult<T = IAccountToken> = {
  tokens: T[];
  tokensMap?: {
    [key: string]: T;
  };
  tokensKeys?: string[];
  tokensTotal: number;
  tokensTotalValue: string | undefined;
  tokensTotalValue24h: string | undefined;
};

export type IOverviewAccountdefisResult = {
  defiKeys?: string[];
  defiValuesMap: Record<
    string,
    {
      claimable: string;
      value: string;
    }
  >;
  defis: OverviewDefiRes[];
};

export type IOverviewAccountNFTResult = {
  nftKeys?: string[];
  nfts: NFTAssetMeta[];
};

export type IAccountTokensSort = 'asc' | 'desc' | boolean;
export type IAccountTokensFilter = {
  hideSmallBalance?: boolean | string;
  hideRiskTokens?: boolean;
  // putMainTokenOnTop?: boolean; // use tokensSort.native=true instead
};
export type IAccountOverviewOptions = {
  networkId: string;
  accountId: string;
  tokensLimit?: number;
  tokensSort?: {
    // TODO move name and native sort to set method
    name?: IAccountTokensSort;
    native?: IAccountTokensSort;
    value?: IAccountTokensSort;
    price?: IAccountTokensSort;
  };
  tokensFilter?: IAccountTokensFilter;
  calculateTokensTotalValue?: boolean;
  buildTokensMapKey?: boolean;
};
export type IBuildTokenPositionInfoOptions = {
  accountId: string;
  networkId: string;
  tokenAddress?: string;
  sendAddress?: string;
  coingeckoId?: string;
};

export default ServiceOverview;
