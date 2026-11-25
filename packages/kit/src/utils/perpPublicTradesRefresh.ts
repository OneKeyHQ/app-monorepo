// Callbacks live in the UI runtime and are registered only by active feeds.
const refreshers = new Set<{
  refresh: () => Promise<void>;
  pending?: Promise<void>;
}>();

export function registerPerpPublicTradesRefresh(refresh: () => Promise<void>) {
  const entry = { refresh };
  refreshers.add(entry);
  return () => {
    refreshers.delete(entry);
  };
}

export async function refreshPerpPublicTrades() {
  await Promise.all(
    [...refreshers].map((entry) => {
      entry.pending ??= entry.refresh().finally(() => {
        entry.pending = undefined;
      });
      return entry.pending;
    }),
  );
}
