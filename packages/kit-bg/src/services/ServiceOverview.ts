import B from 'bignumber.js';
import { cloneDeep, debounce, isNil, isString, uniq } from 'lodash';
import natsort from 'natsort';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  isAllNetworks,
  parseNetworkId,
} from '@onekeyhq/engine/src/managers/network';
import { caseSensitiveImpls } from '@onekeyhq/engine/src/managers/token';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Collection } from '@onekeyhq/engine/src/types/nft';
import type { ITokenFiatValuesInfo } from '@onekeyhq/engine/src/types/token';
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
  setOverviewPortfolioUpdatedAt,
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
import type {
  IAccountToken,
  IOverviewQueryTaskItem,
  IOverviewScanTaskItem,
  IReduxHooksQueryToken,
  OverviewAllNetworksPortfolioRes,
} from '@onekeyhq/kit/src/views/Overview/types';
import { EOverviewScanTaskType } from '@onekeyhq/kit/src/views/Overview/types';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { fetchData } from '@onekeyhq/shared/src/background/backgroundUtils';
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
          scanTypes: Array.from([scanType]),
        });
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

    const updateInfo = appSelector(
      (s) => s.overview.updatedTimeMap?.[dispatchKey],
    );

    if (typeof updateInfo?.updatedAt !== 'undefined' || !pending.length) {
      // not fist loading
      dispatchActions.push(
        setOverviewPortfolioUpdatedAt({
          key: dispatchKey,
          data: {
            updatedAt: Date.now(),
          },
        }),
      );
    }

    // TODO refresherTs
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
        updateRefreshHomeOverviewTs(),
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
    console.log('getPriceOfTokenAsync >>>> ');
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
    token: IAccountTokenData;
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

  // useAccountTokensOnChain -> filterAccountTokens
  buildSingleChainAccountTokens<Key extends IOverviewTokenSchema>(
    options: IAccountOverviewOptions,
    tokenSchema: Key,
  ): IOverviewAccountTokensResult & {
    tokens: IOverviewTokenSchemaMap[Key][];
  };

  // eslint-disable-next-line no-dupe-class-members
  @backgroundMethod()
  buildSingleChainAccountTokens(
    options: IAccountOverviewOptions,
    tokenSchema: IOverviewTokenSchema,
  ): IOverviewAccountTokensResult & {
    tokens: unknown;
  } {
    const {
      accountId,
      networkId,
      tokensFilter,
      tokensSort,
      tokensLimit,
      calculateTokensTotalValue,
      buildTokensMapKey,
    } = options;
    // IAccountTokenOnChain, IAccountTokenData
    const tokens: IAccountTokenData[] = getReduxAccountTokensList({
      networkId,
      accountId,
    });

    let balances: IAccountTokensBalanceMap | undefined;
    let prices: ITokensPricesMap | undefined;
    if (tokensSort) {
      ({ balances } = this.getAccountTokensBalances(options));
      ({ prices } = this.getTokensPrices());
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

    // * sort
    if (tokensSort) {
      const { name, native, value, price } = tokensSort;
      tokensReturn = tokensReturn.sort((a, b) => {
        let condition = 0;
        // putMainTokenOnTop
        if (native) {
          condition =
            condition || (b.isNative ? 1 : 0) || (a.isNative ? -1 : 0);
        }
        // TODO asc support
        if (value === 'desc') {
          condition = condition || new B(b.value ?? 0).comparedTo(a.value ?? 0);
        }
        if (price === 'desc') {
          condition = condition || new B(b.price ?? 0).comparedTo(a.price ?? 0);
        }
        if (name === 'asc') {
          condition =
            condition || natsort({ insensitive: true })(a.name, b.name);
        }
        return condition;
      });
    }

    // * calculate total value (in USD)
    if (calculateTokensTotalValue) {
      totalValue = accValue.toFixed();
      totalValue24h = accValue24h.toFixed();
    }

    // * calculate total before limit
    const tokensTotal = tokensReturn.length;

    // * limit
    if (!isNil(tokensLimit)) {
      tokensReturn = tokensReturn.slice(0, tokensLimit);
    }

    // * build map key
    let tokensKeys: string[] | undefined;
    if (buildTokensMapKey && tokenSchema === 'overview') {
      tokensKeys = tokensReturn.map((token) => {
        const key = (token as IAccountToken)?.key;
        if (!key) {
          throw new Error('buildTokensMapKey ERROR: key is undefined');
        }
        return key;
      });
    }

    return {
      tokensKeys,
      tokens: tokensReturn as any,
      tokensTotal,
      tokensTotalValue: totalValue,
      tokensTotalValue24h: totalValue24h,
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
      .toFixed();
    const totalValue24h = undefined;
    const shareTokens = new B(stats.tokens?.totalValue ?? 0)
      .div(totalValue)
      .toNumber();
    const shareDefis = new B(stats.defis?.totalValue ?? 0)
      .div(totalValue)
      .toNumber();
    const shareNfts = new B(stats.nfts?.totalValue ?? 0)
      .div(totalValue)
      .toNumber();

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

  // this method only build data from DB, not fetch data from server
  // fetch data logic here: refreshCurrentAccount()
  @backgroundMethod()
  async buildAccountOverview(
    options: IAccountOverviewOptions,
  ): Promise<IOverviewAccountTokensResult> {
    const { networkId, accountId } = options;
    // build tokens
    const result = this.buildSingleChainAccountTokens(options, 'overview');
    const stats = this.refreshOverviewStats({
      networkId,
      accountId,
      tokens: {
        totalCounts: result.tokensTotal,
        totalValue: result.tokensTotalValue,
        totalValue24h: result.tokensTotalValue24h,
      },
    });
    console.log('buildAccountOverview --------------------', stats);

    // build defis
    // build nfts
    if (isAllNetworks(options.networkId)) {
      throw new Error('getAccountOverview ERROR: all-network not support yet');
    }
    // TODO loading use hooks
    return Promise.resolve(result);
  }
}

interface IOverviewTokenSchemaMap {
  'raw': IAccountTokenData;
  'overview': IAccountToken;
  // [key: string]: unknown;
}
type IOverviewTokenSchema = keyof IOverviewTokenSchemaMap;
export type IOverviewAccountTokensResult = {
  tokens: IAccountToken[];
  tokensMap?: {
    [key: string]: IAccountToken;
  };
  tokensKeys?: string[];
  tokensTotal: number;
  tokensTotalValue: string | undefined;
  tokensTotalValue24h: string | undefined;
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

export default ServiceOverview;
