import { throttle } from 'lodash';

import {
  isAllNetworks,
  parseNetworkId,
} from '@onekeyhq/engine/src/managers/network';
import { caseSensitiveImpls } from '@onekeyhq/engine/src/managers/token';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import type { IOverviewScanTaskItem } from '@onekeyhq/kit/src/views/Overview/types';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { fetchData } from '@onekeyhq/shared/src/background/backgroundUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceOverview extends ServiceBase {
  private interval: any;

  private pendingTaskMap: Map<string, IOverviewScanTaskItem> = new Map();

  // eslint-disable-next-line @typescript-eslint/require-await
  @bindThis()
  @backgroundMethod()
  async startQueryPendingTasks() {
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
  async queryPendingTasks() {
    const { pendingTaskMap } = this;
    if (!pendingTaskMap.size) {
      return;
    }
    const results = await fetchData<any>(
      '/overview/query/all',
      {
        tasks: [...pendingTaskMap.values()],
      },
      {},
      'POST',
    );
    const keys = this.pendingTaskMap.keys();
    const { pending } = results;
    for (const taskId of keys) {
      if (!pending.find((p: any) => p.taskId === taskId)) {
        this.pendingTaskMap.delete(taskId);
      }
    }
    if (!this.pendingTaskMap.size) {
      this.stopQueryPendingTasks();
    }
  }

  getTaksId({
    networkId,
    address,
    xpub,
    scanType,
  }: {
    networkId: string;
    address: string;
    xpub?: string;
    scanType: string;
  }) {
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

  addPendingTasks(tasks: IOverviewScanTaskItem[]) {
    for (const s of tasks) {
      for (const scanType of s.scanTypes ?? []) {
        const singleTask = {
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

    for (const [k, accounts] of Object.entries(networkAccountsMap)) {
      for (const account of accounts) {
        const { address, xpub } =
          await serviceAccount.getAcccountAddressWithXpub(account.id, k);
        tasks.push({
          networkId: k,
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
      this.addPendingTasks(tasks);
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
