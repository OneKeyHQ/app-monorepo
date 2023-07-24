import { debounce, uniq } from 'lodash';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  isAllNetworks,
  parseNetworkId,
} from '@onekeyhq/engine/src/managers/network';
import { caseSensitiveImpls } from '@onekeyhq/engine/src/managers/token';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Collection } from '@onekeyhq/engine/src/types/nft';
import { setNFTPrice } from '@onekeyhq/kit/src/store/reducers/nft';
import type { IOverviewPortfolio } from '@onekeyhq/kit/src/store/reducers/overview';
import {
  addOverviewPendingTasks,
  removeOverviewPendingTasks,
  setOverviewPortfolioUpdatedAt,
} from '@onekeyhq/kit/src/store/reducers/overview';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import type {
  IOverviewQueryTaskItem,
  IOverviewScanTaskItem,
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
    debugLogger.overview.info('subscribe overview tasks=', tasks);
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

  refreshCurrentAccountWithDebounce = debounce(
    async () => {
      const { appSelector } = this.backgroundApi;

      const {
        activeAccountId: accountId,
        activeNetworkId: networkId,
        activeWalletId: walletId,
      } = appSelector((s) => s.general);

      if (!accountId || !networkId) {
        return;
      }

      return this.refreshAccountAssets({ networkId, accountId, walletId });
    },
    getTimeDurationMs({ seconds: 5 }),
    {
      leading: true,
      trailing: true,
    },
  );

  @backgroundMethod()
  refreshCurrentAccount() {
    return this.refreshCurrentAccountWithDebounce();
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
}

export default ServiceOverview;
