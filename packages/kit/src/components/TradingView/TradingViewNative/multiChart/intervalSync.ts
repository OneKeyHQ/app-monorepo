export interface ITradingViewNativeIntervalSyncMember {
  /** Changes the shared interval, as when the user picks one in this panel. */
  set: (interval: string) => void;
  leave: () => void;
}

export interface ITradingViewNativeIntervalSync {
  /** The interval the panels share; undefined until a panel sets it. */
  get: () => string | undefined;
  /**
   * Joins a panel. `onChange` is called when another panel changes the shared
   * interval, never for this panel's own change: it is already moving there.
   */
  join: (onChange: () => void) => ITradingViewNativeIntervalSyncMember;
}

/**
 * Holds the interval that every panel of a split view uses. With `start`, the
 * panels take that interval as they join; without one, they share nothing
 * until a panel sets it.
 */
export function createTradingViewNativeIntervalSync(
  start?: string,
): ITradingViewNativeIntervalSync {
  const listeners = new Set<() => void>();
  let shared = start;
  return {
    get: () => shared,
    join: (onChange) => {
      listeners.add(onChange);
      return {
        set: (interval) => {
          if (interval === shared) return;
          shared = interval;
          for (const listener of listeners) {
            if (listener !== onChange) listener();
          }
        },
        leave: () => {
          listeners.delete(onChange);
        },
      };
    },
  };
}
