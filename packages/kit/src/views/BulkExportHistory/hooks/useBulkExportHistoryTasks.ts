import { useMemo, useRef } from 'react';

import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IExportTransactionHistoryTask,
  IFetchExportTransactionHistoryTasksResp,
} from '@onekeyhq/shared/types/history';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const EXPORT_HISTORY_TASK_POLLING_INTERVAL_MS = timerUtils.getTimeDurationMs({
  seconds: 5,
});

export function useBulkExportHistoryTasks() {
  const promiseResult =
    usePromiseResult<IFetchExportTransactionHistoryTasksResp>(
      async () =>
        backgroundApiProxy.serviceHistory.fetchExportTransactionHistoryTasks(),
      [],
      { watchLoading: true },
    );

  // Polling delivers a fresh list object every tick even when nothing changed;
  // reuse the previous sorted array in that case so memoized consumers (list
  // rows, task detail derivations) can bail out on no-change ticks.
  const sortedTasksRef = useRef<
    | {
        key: string;
        tasks: IExportTransactionHistoryTask[];
      }
    | undefined
  >(undefined);
  const tasks = useMemo(() => {
    const list = promiseResult.result?.list ?? [];
    const key = JSON.stringify(list);
    if (sortedTasksRef.current?.key === key) {
      return sortedTasksRef.current.tasks;
    }
    const sortedTasks = [...list].toSorted(
      (taskA, taskB) => taskB.createdAt - taskA.createdAt,
    );
    sortedTasksRef.current = { key, tasks: sortedTasks };
    return sortedTasks;
  }, [promiseResult.result]);

  return {
    ...promiseResult,
    tasks,
  };
}

export function useBulkExportHistoryTaskPolling({
  enabled,
  isLoading,
  run,
}: {
  enabled: boolean;
  isLoading: boolean | undefined;
  run: () => Promise<void>;
}) {
  const isFocused = useRouteIsFocused();

  useInterval(
    () => {
      void run().catch(() => undefined);
    },
    isFocused && enabled && !isLoading
      ? EXPORT_HISTORY_TASK_POLLING_INTERVAL_MS
      : null,
  );
}
