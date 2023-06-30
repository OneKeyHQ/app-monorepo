import { throttle } from 'lodash';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  isAllNetworks,
  parseNetworkId,
} from '@onekeyhq/engine/src/managers/network';
import { caseSensitiveImpls } from '@onekeyhq/engine/src/managers/token';
import { serOverviewPortfolioUpdatedAt } from '@onekeyhq/kit/src/store/reducers/overview';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import type {
  IOverviewQueryTaskItem,
  IOverviewScanTaskItem,
  OverviewAllNetworksPortfolioRes,
} from '@onekeyhq/kit/src/views/Overview/types';
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

  private pendingTaskMap: Map<string, IOverviewQueryTaskItem> = new Map();

  constructor(props: IServiceBaseProps) {
    super(props);
    this.interval = setInterval(() => {
      this.queryPendingTasks();
      // TODO: change thids to 15s
    }, getTimeDurationMs({ seconds: 3 }));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  @bindThis()
  @backgroundMethod()
  async startQueryPendingTasks() {
    // if (this.interval) {
    //   return;
    // }
    // debugLogger.common.info('startQueryPendingTasks');
    // this.interval = setInterval(() => {
    //   this.queryPendingTasks();
    //   // TODO: change thids to 15s
    // }, getTimeDurationMs({ seconds: 3 }));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  @bindThis()
  @backgroundMethod()
  async stopQueryPendingTasks() {
    // clearInterval(this.interval);
    // this.interval = null;
    // debugLogger.common.info('stopQueryPendingTasks');
  }

  @backgroundMethod()
  async queryPendingTasks() {
    const { appSelector, dispatch } = this.backgroundApi;
    const { activeNetworkId: networkId = '', activeAccountId: accountId = '' } =
      appSelector((s) => s.general);
    if (!networkId || !accountId) {
      return;
    }
    const dispatchKey = `${networkId}___${accountId}`;
    const pendingTasksForCurrentNetwork = Array.from(
      this.pendingTaskMap.values(),
    ).filter((n) => n.key === dispatchKey);

    if (!pendingTasksForCurrentNetwork?.length) {
      return;
    }

    const results = await fetchData<
      OverviewAllNetworksPortfolioRes & {
        pending: IOverviewScanTaskItem[];
      }
    >(
      '/overview/query/all',
      {
        tasks: [...pendingTasksForCurrentNetwork],
      },
      {
        pending: [],
        tokens: [],
        defis: [],
        nfts: [],
      },
      'POST',
    );
    const { pending } = results;
    if (!pending?.length) {
      for (const task of pendingTasksForCurrentNetwork) {
        this.pendingTaskMap.delete(this.getTaksId(task));
      }
    }
    await simpleDb.accountPortfolios.setAllNetworksPortfolio({
      key: dispatchKey,
      data: results,
    });
    dispatch(
      serOverviewPortfolioUpdatedAt({
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
            !this.pendingTaskMap.has(
              this.getTaksId({
                networkId: t.networkId,
                address: t.address,
                xpub: t.xpub,
                scanType: s,
              }),
            ),
        ),
      }))
      .filter((t) => t.scanTypes.length > 0);
  }

  addPendingTasks(tasks: IOverviewScanTaskItem[], key?: string) {
    for (const s of tasks) {
      for (const scanType of s.scanTypes ?? []) {
        const singleTask = {
          key,
          networkId: s.networkId,
          address: s.address,
          xpub: s.xpub,
          scanType,
        };
        this.pendingTaskMap.set(this.getTaksId(singleTask), singleTask);
      }
    }
  }

  async buildOverviewScanTasks({
    networkId,
    accountId,
    walletId,
    scanTypes = ['defi', 'token', 'nfts'],
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
    }: {
      networkId: string;
      accountId: string;
    }) => {
      const { engine, serviceToken, appSelector } = this.backgroundApi;

      engine.clearPriceCache();
      await serviceToken.fetchAccountTokens({
        accountId,
        networkId,
        forceReloadTokens: true,
        includeTop50TokensQuery: true,
      });

      await this.fetchAccountOverview({
        networkId,
        accountId,
        walletId: appSelector((s) => s.general.activeWalletId) ?? '',
        scanTypes: ['defi'],
      });
    },
    getTimeDurationMs({ seconds: 5 }),
  );

  @bindThis()
  @backgroundMethod()
  async refreshCurrentAccount() {
    const { appSelector } = this.backgroundApi;

    const { activeAccountId: accountId, activeNetworkId: networkId } =
      appSelector((s) => s.general);

    if (!accountId || !networkId) {
      return;
    }

    return this.refreshAccountWithThrottle({ networkId, accountId });
  }
}

export default ServiceOverview;
