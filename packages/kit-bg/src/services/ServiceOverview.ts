import { debounce, pick, throttle, uniqBy } from 'lodash';

import { setOverviewPortfolioDefi } from '@onekeyhq/kit/src/store/reducers/overview';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import type {
  IOverviewScanTaskItem,
  IOverviewScanTaskType,
  OverviewDefiRes,
} from '@onekeyhq/kit/src/views/Overview/types';
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

  private pendingTasks: IOverviewScanTaskItem[] = [];

  // eslint-disable-next-line @typescript-eslint/require-await
  @bindThis()
  @backgroundMethod()
  async startQueryPendingTasks() {
    if (this.interval) {
      return;
    }
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
  }

  subscribeDebounced = debounce(
    async () => {
      const { appSelector, serviceAccount } = this.backgroundApi;
      const {
        activeAccountId,
        activeNetworkId: networkId,
        activeWalletId,
      } = appSelector((s) => s.general);
      if (!activeWalletId || !activeAccountId) {
        return;
      }

      const account = await serviceAccount.getAccount({
        walletId: activeWalletId || '',
        accountId: activeAccountId || '',
      });
      if (!account || !networkId) {
        return;
      }
      const { address } = account;
      if (
        this.pendingTasks.some(
          (t) => t.networkId === networkId && t.address === address,
        )
      ) {
        return;
      }
      const task: IOverviewScanTaskItem = {
        networkId,
        address,
        scanTypes: ['defi'],
      };
      debugLogger.overview.info('subscribe overview task=', task);
      const res = await fetchData<{
        tasks?: IOverviewScanTaskItem[];
      }>(
        '/overview/subscribe',
        {
          tasks: [task],
        },
        {},
        'POST',
      );
      if (res.tasks) {
        this.pendingTasks.push(task);
      }
      return res;
    },
    getTimeDurationMs({ seconds: 5 }),
    {
      leading: false,
      trailing: true,
    },
  );

  @bindThis()
  @backgroundMethod()
  async subscribe() {
    return this.subscribeDebounced();
  }

  @backgroundMethod()
  async queryPendingTasks() {
    const { pendingTasks } = this;
    if (!pendingTasks.length) {
      return;
    }
    let newPendingTasks: IOverviewScanTaskItem[] = [];
    for (const taskType of [
      'defi',
      'token',
      'nfts',
    ] as IOverviewScanTaskType[]) {
      const tasks = uniqBy(
        pendingTasks.filter((t) => t.scanTypes?.includes(taskType)),
        (n) => `${n.networkId}--${n.address}`,
      );
      try {
        if (taskType === 'defi') {
          newPendingTasks = newPendingTasks.concat(
            await this.queryOverviewDefis(tasks),
          );
        }
        // TODO: tokens nfts histories
      } catch (e) {
        debugLogger.overview.info('query pending task error, error=', e, tasks);
      }
    }
    this.pendingTasks = newPendingTasks;
  }

  async queryOverviewDefis(tasks: IOverviewScanTaskItem[]) {
    const buildByService = this.backgroundApi.appSelector(
      (s) => s.settings.devMode?.defiBuildService,
    );
    const body = {
      tasks: tasks.map((t) => pick(t, 'networkId', 'address')),
    };
    if (buildByService && buildByService !== 'all') {
      Object.assign(body, {
        buildByService,
      });
    }
    const res = await this.query<OverviewDefiRes[]>('defi', body);
    const { dispatch, appSelector } = this.backgroundApi;
    const data = tasks.map((t) => ({
      networkId: t.networkId,
      address: t.address,
      data:
        res.data?.filter(
          (d) => d._id.networkId === t.networkId && d._id.address === t.address,
        ) ?? [],
    }));
    const pendingTasks =
      res.status?.pending.map((n) => ({
        ...n,
        scanTypes: ['defi'] as IOverviewScanTaskType[],
      })) ?? [];

    const savedDefiList = appSelector((s) => {
      const defis = s.overview.defi;
      return tasks
        .map((t) => defis?.[`${t.networkId}--${t.address}`])
        .flat()
        .filter((n) => !!n);
    });

    if (!pendingTasks.length || !savedDefiList?.length) {
      dispatch(...data.map(setOverviewPortfolioDefi));
      debugLogger.overview.info('fetch defis done', data);
    }

    return pendingTasks;
  }

  refreshAccountWithThrottle = throttle(
    async ({
      networkId,
      accountId,
    }: {
      networkId: string;
      accountId: string;
    }) => {
      const { engine, serviceToken } = this.backgroundApi;

      engine.clearPriceCache();
      await serviceToken.fetchAccountTokens({
        accountId,
        networkId,
        forceReloadTokens: true,
        includeTop50TokensQuery: true,
      });

      await this.subscribe();
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

  @backgroundMethod()
  async query<T>(
    scanType: IOverviewScanTaskType,
    body: {
      buildByService?: string;
      tasks: IOverviewScanTaskItem[];
    },
  ) {
    return fetchData<{
      status?: {
        pending: Omit<IOverviewScanTaskItem, 'taskType'>[];
      };
      data?: T;
    }>(`/overview/query/${scanType}`, body, {}, 'POST');
  }
}

export default ServiceOverview;
