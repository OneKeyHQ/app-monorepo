export interface ITradingViewNativeIntervalSync {
  /** The interval the panels share; undefined until the first panel sets it. */
  get: () => string | undefined;
  /** Changes the shared interval, as when the user picks one in a panel. */
  set: (interval: string) => void;
  /** Calls `onChange` whenever the shared interval changes. */
  subscribe: (onChange: () => void) => () => void;
}

/** Holds the interval that every panel of a split view uses. */
export function createTradingViewNativeIntervalSync(): ITradingViewNativeIntervalSync {
  const listeners = new Set<() => void>();
  let shared: string | undefined;
  return {
    get: () => shared,
    set: (interval) => {
      if (interval === shared) return;
      shared = interval;
      for (const onChange of listeners) onChange();
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}
