import { useCallback, useEffect, useRef, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

// A request belongs to the currently focused, unlocked screen. Late responses
// must never repopulate a screen after identity, route or lock changes.
export function useSupportResource<T>(
  load: () => Promise<T>,
  enabled: boolean,
  poll = false,
) {
  const generation = useRef(0);
  const pending = useRef<number | undefined>(undefined);
  const refreshAfterPush = useRef(false);
  const [state, setState] = useState<{
    load: () => Promise<T>;
    data?: T;
    loading: boolean;
    failed: boolean;
  }>({ load, loading: enabled, failed: false });
  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled || pending.current !== undefined) return;
    generation.current += 1;
    const current = generation.current;
    pending.current = current;
    setState((previous) => ({
      load,
      data: previous.load === load ? previous.data : undefined,
      loading: true,
      failed: false,
    }));
    try {
      const data = await load();
      if (current === generation.current)
        setState({ load, data, loading: false, failed: false });
    } catch {
      if (current === generation.current)
        setState((previous) => ({ ...previous, loading: false, failed: true }));
    } finally {
      if (pending.current === current) pending.current = undefined;
      if (current === generation.current && refreshAfterPush.current) {
        refreshAfterPush.current = false;
        void refresh();
      }
    }
  }, [enabled, load]);
  useEffect(() => {
    setState((previous) =>
      previous.load === load
        ? { ...previous, loading: enabled && previous.loading }
        : { load, loading: enabled, failed: false },
    );
    void refresh();
    const timer =
      enabled && poll
        ? setInterval(() => {
            void refresh();
          }, 15_000)
        : undefined;
    const onPush = () => {
      if (pending.current !== undefined) refreshAfterPush.current = true;
      else void refresh();
    };
    if (enabled && poll)
      appEventBus.on(EAppEventBusNames.SupportConversationUpdated, onPush);
    return () => {
      generation.current += 1;
      pending.current = undefined;
      refreshAfterPush.current = false;
      if (timer) clearInterval(timer);
      appEventBus.off(EAppEventBusNames.SupportConversationUpdated, onPush);
    };
  }, [enabled, load, refresh, poll]);
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
