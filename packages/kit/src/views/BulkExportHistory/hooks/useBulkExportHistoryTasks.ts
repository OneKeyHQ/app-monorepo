import { useEffect, useMemo } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IFetchExportTransactionHistoryTasksResp } from '@onekeyhq/shared/types/history';

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

  const tasks = useMemo(
    () =>
      [...(promiseResult.result?.list ?? [])].toSorted(
        (taskA, taskB) => taskB.createdAt - taskA.createdAt,
      ),
    [promiseResult.result],
  );

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

  useEffect(() => {
    if (!isFocused || !enabled || isLoading) {
      return undefined;
    }

    const timer = setInterval(() => {
      void run().catch(() => undefined);
    }, EXPORT_HISTORY_TASK_POLLING_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, isFocused, isLoading, run]);
}
