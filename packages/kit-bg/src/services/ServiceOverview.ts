import { isEqual, pick } from 'lodash';

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
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { fetchData } from '@onekeyhq/shared/src/background/backgroundUtils';

import ServiceBase from './ServiceBase';

import type { IServiceBaseProps } from './ServiceTransaction';

@backgroundClass()
class ServiceOverview extends ServiceBase {
  constructor(props: IServiceBaseProps) {
    super(props);

    this.queryPendingTasks();
    setInterval(() => {
      this.queryPendingTasks();
    }, getTimeDurationMs({ seconds: 15 }));
  }

  private pendingTasks: IOverviewScanTaskItem[] = [];

  @backgroundMethod()
  async subscribe(tasks: IOverviewScanTaskItem[]) {
    const validTasks = tasks.filter(
      (t) => !this.pendingTasks.some((task) => isEqual(t, task)),
    );
    if (!validTasks.length) {
      return;
    }
    const res = await fetchData<{
      tasks?: IOverviewScanTaskItem[];
    }>(
      '/overview/subscribe',
      {
        tasks: validTasks,
      },
      {},
      'POST',
    );
    if (res.tasks) {
      this.pendingTasks.push(...validTasks);
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
    const res = await this.query<OverviewDefiRes[]>(
      'defi',
      tasks.map((t) => pick(t, 'networkId', 'address')),
    );
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
    tasks: IOverviewScanTaskItem[],
  ) {
    return fetchData<{
      status?: {
        pending: Omit<IOverviewScanTaskItem, 'taskType'>[];
      };
      data?: T;
    }>(
      `/overview/query/${scanType}`,
      {
        tasks,
      },
      {},
      'POST',
    );
  }
}

export default ServiceOverview;
