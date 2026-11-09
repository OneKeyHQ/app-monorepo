import { useCallback, useEffect, useRef, useState } from 'react';

// A request belongs to the currently focused, unlocked screen. Late responses
// must never repopulate a screen after identity, route or lock changes.
export function useSupportResource<T>(
  load: () => Promise<T>,
  enabled: boolean,
  poll = false,
) {
  const generation = useRef(0);
  const pending = useRef<number | undefined>(undefined);
  const [state, setState] = useState<{
    load: () => Promise<T>;
    data?: T;
    loading: boolean;
    failed: boolean;
  }>({ load, loading: enabled, failed: false });
  const refresh = useCallback(async () => {
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
    return () => {
      generation.current += 1;
      pending.current = undefined;
      if (timer) clearInterval(timer);
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
