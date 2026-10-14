export type IJotaiNativeStorageHydration = {
  /** Whether the UI runtime's atoms now carry the persisted values. */
  hydrated: boolean;
  atomCount: number;
  /** Why the fast path stepped aside, for startup diagnostics. */
  reason?:
    | 'not-native'
    | 'not-main-runtime'
    | 'travel-mode'
    | 'store-unavailable'
    | 'not-migrated'
    | 'empty';
};
