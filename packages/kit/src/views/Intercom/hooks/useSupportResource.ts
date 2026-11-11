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
  const task = useRef<ReturnType<typeof createSupportPollingTask> | undefined>(
    undefined,
  );
  const [state, setState] = useState<{
    load: () => Promise<T>;
    data?: T;
    loading: boolean;
    failed: boolean;
  }>({ load, loading: enabled, failed: false });
  useEffect(() => {
    let disposed = false;
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
          if (!disposed)
            setState({ load, data, loading: false, failed: false });
        } catch (error) {
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
    task.current = current;
    void current.refresh();
    const onPush = () => current.push();
    if (poll)
      appEventBus.on(EAppEventBusNames.SupportConversationUpdated, onPush);
    return () => {
      disposed = true;
      current.stop();
      if (task.current === current) task.current = undefined;
      appEventBus.off(EAppEventBusNames.SupportConversationUpdated, onPush);
    };
  }, [enabled, load, poll]);
  const refresh = useCallback(async () => {
    await task.current?.refresh();
  }, []);
  const current =
    state.load === load
      ? state
      : { data: undefined, loading: enabled, failed: false };
  return {
    data: current.data,
    loading: current.loading,
    failed: current.failed,
    refresh,
  };
}
