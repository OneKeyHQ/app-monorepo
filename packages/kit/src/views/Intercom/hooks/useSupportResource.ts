import { useCallback, useEffect, useRef, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { createSupportPollingTask } from '../client/polling';

// A response belongs to one focused, unlocked screen. Disposing a task also
// revokes its results, even if the transport finishes after blur or identity change.
export function useSupportResource<T>(
  load: () => Promise<T>,
  enabled: boolean,
  poll = false,
) {
  const task = useRef<
    | {
        refresh: () => Promise<void>;
        refreshData: () => Promise<T | undefined>;
      }
    | undefined
  >(undefined);
  const [state, setState] = useState<{
    load: () => Promise<T>;
    data?: T;
    loading: boolean;
    failed: boolean;
  }>({ load, loading: enabled, failed: false });
  useEffect(() => {
    let disposed = false;
    let latestResult: T | undefined;
    setState((previous) =>
      previous.load === load
        ? { ...previous, loading: enabled }
        : { load, loading: enabled, failed: false },
    );
    if (!enabled) return;
    const current = createSupportPollingTask(
      async () => {
        if (disposed) return;
        setState((previous) => ({
          load,
          data: previous.load === load ? previous.data : undefined,
          loading: true,
          failed: false,
        }));
        try {
          const data = await load();
          if (!disposed) {
            latestResult = data;
            setState({ load, data, loading: false, failed: false });
          }
        } catch (error) {
          latestResult = undefined;
          if (!disposed)
            setState((previous) => ({
              ...previous,
              loading: false,
              failed: true,
            }));
          throw error;
        }
      },
      poll ? 15_000 : undefined,
    );
    const resourceTask = {
      refresh: current.refresh,
      async refreshData() {
        // A write must not be acknowledged by a poll started before it.
        await current.refreshAfterCurrent();
        return disposed ? undefined : latestResult;
      },
    };
    task.current = resourceTask;
    void current.refresh();
    const onPush = () => current.push();
    if (poll)
      appEventBus.on(EAppEventBusNames.SupportConversationUpdated, onPush);
    return () => {
      disposed = true;
      current.stop();
      if (task.current === resourceTask) task.current = undefined;
      appEventBus.off(EAppEventBusNames.SupportConversationUpdated, onPush);
    };
  }, [enabled, load, poll]);
  const refresh = useCallback(async () => {
    await task.current?.refresh();
  }, []);
  const refreshData = useCallback(async () => task.current?.refreshData(), []);
  const current =
    state.load === load
      ? state
      : { data: undefined, loading: enabled, failed: false };
  return {
    data: current.data,
    loading: current.loading,
    failed: current.failed,
    refresh,
    refreshData,
  };
}
