import { pick } from 'lodash';

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
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceOverview extends ServiceBase {
  private pendingTasks: IOverviewScanTaskItem[] = [];

  @bindThis()
  registerEvents() {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    appEventBus.on(AppEventBusNames.AccountChanged, this.subscribe);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    appEventBus.on(AppEventBusNames.NetworkChanged, this.subscribe);

    setInterval(() => {
      this.queryPendingTasks();
    }, getTimeDurationMs({ seconds: 15 }));

    this.subscribe();
  }

  @bindThis()
  @backgroundMethod()
  async subscribe() {
    const { appSelector, serviceAccount } = this.backgroundApi;
    const {
      activeAccountId,
      activeNetworkId: networkId,
      activeWalletId,
    } = appSelector((s) => s.general);

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
      this.queryPendingTasks();
    }
    return res;
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
      const tasks = pendingTasks.filter((t) => t.scanTypes?.includes(taskType));
      try {
        if (taskType === 'defi') {
          newPendingTasks = newPendingTasks.concat(
            await this.queryOverviewDefis(tasks),
          );
        }
        // TODO: tokens nfts histories
      } catch (e) {
        console.log(e, tasks);
        // pass
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
    }

    return pendingTasks;
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
