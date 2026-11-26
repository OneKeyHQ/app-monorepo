import { useCallback, useEffect, useRef, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { createSupportPollingTask } from '../client/polling';

// The last answer of the session that a loader reads. A screen that opens again
// shows it at once instead of placeholders and refreshes it in place.
export type ISupportResourceCache<T> = {
  read: () => T | undefined;
  save: (data: T) => void;
};

type ISupportResourceState<T> = {
  load: () => Promise<T>;
  data?: T;
  loading: boolean;
  failed: boolean;
  // The current loader has answered at least once, with data or a failure, or
  // starts from a cached answer. Later retries keep it set so a screen shows
  // its first-load placeholder only once.
  settled: boolean;
};

function initialState<T>(
  load: () => Promise<T>,
  loading: boolean,
  cache: ISupportResourceCache<T> | undefined,
): ISupportResourceState<T> {
  const data = cache?.read();
  return { load, data, loading, failed: false, settled: data !== undefined };
}

// A response belongs to one focused, unlocked screen. Disposing a task also
// revokes its results, even if the transport finishes after blur or identity change.
// Like `load`, `cache` must keep its identity until the session changes.
export function useSupportResource<T>(
  load: () => Promise<T>,
  enabled: boolean,
  poll = false,
  cache?: ISupportResourceCache<T>,
) {
  const task = useRef<
    | {
        refresh: () => Promise<void>;
        refreshData: () => Promise<T | undefined>;
      }
    | undefined
  >(undefined);
  const [state, setState] = useState(() => initialState(load, enabled, cache));
  useEffect(() => {
    let disposed = false;
    let latestResult: T | undefined;
    setState((previous) =>
      previous.load === load
        ? { ...previous, loading: enabled }
        : initialState(load, enabled, cache),
    );
    if (!enabled) return;
    const current = createSupportPollingTask(
      async () => {
        if (disposed) return;
        setState((previous) =>
          previous.load === load
            ? { ...previous, loading: true, failed: false }
            : initialState(load, true, cache),
        );
        try {
          const data = await load();
          if (!disposed) {
            latestResult = data;
            cache?.save(data);
            setState({
              load,
              data,
              loading: false,
              failed: false,
              settled: true,
            });
          }
        } catch (error) {
          latestResult = undefined;
          if (!disposed)
            setState((previous) => ({
              ...previous,
              loading: false,
              failed: true,
              settled: true,
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
  }, [cache, enabled, load, poll]);
  const refresh = useCallback(async () => {
    await task.current?.refresh();
  }, []);
  const refreshData = useCallback(async () => task.current?.refreshData(), []);
  const current =
    state.load === load ? state : initialState(load, enabled, cache);
  return {
    data: current.data,
    loading: current.loading,
    failed: current.failed,
    settled: current.settled,
    refresh,
    refreshData,
  };
}
