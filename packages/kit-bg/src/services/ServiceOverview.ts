import { throttle } from 'lodash';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  isAllNetworks,
  parseNetworkId,
} from '@onekeyhq/engine/src/managers/network';
import { caseSensitiveImpls } from '@onekeyhq/engine/src/managers/token';
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
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
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
          pending: IOverviewScanTaskItem[];
        })
      | null
    >(
      '/overview/query/all',
      {
        tasks: [...pendingTasksForCurrentNetwork],
      },
      null,
      'POST',
    );
    if (!results) {
      return;
    }
    const resolvedScanTypes: Set<EOverviewScanTaskType> = new Set();
    const { pending } = results;
    const dispatchActions = [];
    if (!pending?.length) {
      const taskIdsWillRemove = pendingTasksForCurrentNetwork.map((t) => {
        resolvedScanTypes.add(t.scanType);
        return this.getTaksId(t);
      });
      if (taskIdsWillRemove?.length) {
        dispatchActions.push(
          removeOverviewPendingTasks({
            ids: taskIdsWillRemove,
          }),
        );
      }
    }
    if (
      results.nfts?.length &&
      ![OnekeyNetwork.btc, OnekeyNetwork.tbtc].includes(networkId)
    ) {
      let lastSalePrice = 0;
      const floorPrice = 0; // Not used
      results.nfts = (results.nfts as Collection[]).map((item) => {
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
        lastSalePrice += totalPrice;
        return item;
      });
      dispatchActions.push(
        setNFTPrice({
          networkId,
          accountId,
          price: { floorPrice, lastSalePrice },
        }),
      );
    }
    await simpleDb.accountPortfolios.setAllNetworksPortfolio({
      key: dispatchKey,
      data: results,
      scanTypes: Array.from(resolvedScanTypes),
    });
    dispatch(
      ...dispatchActions,
      setOverviewPortfolioUpdatedAt({
        key: dispatchKey,
        data: {
          updatedAt: Date.now(),
        },
      }),
    );
  }

  getTaksId({ networkId, address, xpub, scanType }: IOverviewQueryTaskItem) {
    let accountAddress = address;
    const { impl } = parseNetworkId(networkId);
    if (impl && !caseSensitiveImpls.has(impl)) {
      accountAddress = (accountAddress || '').toLowerCase();
    }
    return `${scanType}___${networkId}___${accountAddress}___${xpub ?? ''}`;
  }

  filterNewScanTasks(tasks: IOverviewScanTaskItem[]) {
    return tasks
      .map((t) => ({
        ...t,
        scanTypes: (t.scanTypes ?? []).filter(
          (s) =>
            !this.pendingTaskMap[
              this.getTaksId({
                networkId: t.networkId,
                address: t.address,
                xpub: t.xpub,
                scanType: s,
              })
            ],
        ),
      }))
      .filter((t) => t.scanTypes.length > 0);
  }

  @bindThis()
  addPendingTasks(tasks: IOverviewScanTaskItem[], key?: string) {
    const { dispatch } = this.backgroundApi;
    const pending: IOverviewPortfolio['tasks'] = {};
    for (const s of tasks) {
      for (const scanType of s.scanTypes ?? []) {
        const singleTask = {
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
    walletId,
    scanTypes = [
      EOverviewScanTaskType.defi,
      EOverviewScanTaskType.token,
      EOverviewScanTaskType.nfts,
    ],
  }: {
    networkId: string;
    accountId: string;
    walletId?: string;
    scanTypes: IOverviewScanTaskItem['scanTypes'];
  }): Promise<IOverviewScanTaskItem[]> {
    const { serviceAccount, serviceAllNetwork } = this.backgroundApi;
    if (!isAllNetworks(networkId)) {
      const { address, xpub } = await serviceAccount.getAcccountAddressWithXpub(
        accountId,
        networkId,
      );
      return this.filterNewScanTasks([
        {
          networkId,
          address,
          xpub,
          scanTypes,
        },
      ]);
    }
    if (!walletId) {
      return [];
    }

    const networkAccountsMap =
      await serviceAllNetwork.getAllNetworksWalletAccounts({
        accountId,
        walletId,
      });

    const tasks: IOverviewScanTaskItem[] = [];

    for (const [nid, accounts] of Object.entries(networkAccountsMap)) {
      for (const account of accounts) {
        const { address, xpub } =
          await serviceAccount.getAcccountAddressWithXpub(account.id, nid);
        tasks.push({
          networkId: nid,
          address,
          xpub,
          scanTypes,
        });
      }
    }
    return this.filterNewScanTasks(tasks);
  }

  @backgroundMethod()
  async fetchAccountOverview({
    networkId,
    accountId,
    walletId,
    scanTypes,
  }: {
    networkId: string;
    accountId: string;
    walletId?: string;
    scanTypes?: IOverviewScanTaskItem['scanTypes'];
  }) {
    const tasks = await this.buildOverviewScanTasks({
      networkId,
      accountId,
      walletId,
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

  refreshAccountWithThrottle = throttle(
    async ({
      networkId,
      accountId,
      walletId,
    }: {
      networkId: string;
      accountId: string;
      walletId: string | null;
    }) => {
      const { engine, serviceToken } = this.backgroundApi;
      if (!networkId || !accountId || !walletId) {
        return;
      }
      if (!isAllNetworks(networkId)) {
        engine.clearPriceCache();
        await serviceToken.fetchAccountTokens({
          accountId,
          networkId,
          forceReloadTokens: true,
          includeTop50TokensQuery: true,
        });
      }
      await this.fetchAccountOverview({
        networkId,
        accountId,
        walletId,
        scanTypes: [
          EOverviewScanTaskType.defi,
          EOverviewScanTaskType.token,
          EOverviewScanTaskType.nfts,
        ],
      });
    },
    getTimeDurationMs({ seconds: 5 }),
  );

  @bindThis()
  @backgroundMethod()
  async refreshCurrentAccount() {
    const { appSelector } = this.backgroundApi;

    const {
      activeAccountId: accountId,
      activeNetworkId: networkId,
      activeWalletId: walletId,
    } = appSelector((s) => s.general);

    if (!accountId || !networkId) {
      return;
    }

    return this.refreshAccountWithThrottle({ networkId, accountId, walletId });
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
