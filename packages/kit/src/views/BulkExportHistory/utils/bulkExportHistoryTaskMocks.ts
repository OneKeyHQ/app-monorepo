import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IExportTransactionHistoryTask } from '@onekeyhq/shared/types/history';

const MOCK_TASK_ID_START = -10_000;
const MOCK_REFERENCE_TIME = Date.now();
const MOCK_STATUS_CONFIGS: Array<{
  status: IExportTransactionHistoryTask['status'];
  networkIds: string[];
  count: number;
  isPartial?: boolean;
}> = [
  {
    status: 'pending',
    networkIds: ['evm--1'],
    count: 0,
  },
  {
    status: 'processing',
    networkIds: ['evm--1', 'evm--8453', 'evm--42161'],
    count: 0,
  },
  {
    status: 'success',
    networkIds: ['evm--8453'],
    count: 281,
  },
  {
    status: 'success',
    networkIds: ['evm--1', 'sol--101', 'btc--0'],
    count: 10_000,
    isPartial: true,
  },
  {
    status: 'failed',
    networkIds: ['sol--101'],
    count: 0,
  },
  {
    status: 'deprecated',
    networkIds: ['btc--0'],
    count: 281,
  },
];

const MOCK_TASKS = MOCK_STATUS_CONFIGS.map(
  ({ status, networkIds, count, isPartial }, index) => {
    const createdAt =
      MOCK_REFERENCE_TIME - timerUtils.getTimeDurationMs({ minute: index });
    const maxTimestampMs =
      MOCK_REFERENCE_TIME - timerUtils.getTimeDurationMs({ day: index * 7 });
    const minTimestampMs =
      maxTimestampMs - timerUtils.getTimeDurationMs({ month: 1 });

    return {
      id: MOCK_TASK_ID_START - index,
      next: isPartial ? maxTimestampMs - 1 : null,
      createdAt,
      updatedAt: createdAt + timerUtils.getTimeDurationMs({ seconds: 30 }),
      uid: 'bulk-export-history-status-mock',
      query: {
        networkIdToAddressArray: Object.fromEntries(
          networkIds.map((networkId) => [
            networkId,
            [`mock-address-${networkId}`],
          ]),
        ),
        limit: 10_000,
        maxTimestampMs,
        minTimestampMs,
        onlySafe: index % 2 === 0,
        timeZone: '+08:00',
      },
      status,
      filename: `mock-export-${index}.csv`,
      count,
      message: status === 'failed' ? 'Mock export failed' : 'ok',
    } satisfies IExportTransactionHistoryTask;
  },
);

export function isBulkExportHistoryMockTaskId(taskId: number) {
  return taskId <= MOCK_TASK_ID_START;
}

export function withBulkExportHistoryStatusMocks(
  tasks: IExportTransactionHistoryTask[],
) {
  return platformEnv.isDev ? [...MOCK_TASKS, ...tasks] : tasks;
}

export function getBulkExportHistoryMockCsv(
  task: IExportTransactionHistoryTask,
) {
  const networkIds = Object.keys(task.query.networkIdToAddressArray);
  return [
    'network,status,date_range',
    `${networkIds.join('|')},${task.status},${task.query.minTimestampMs}-${
      task.query.maxTimestampMs
    }`,
  ].join('\n');
}
