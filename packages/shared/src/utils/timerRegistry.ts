type ITimerEntry = {
  source: string;
  intervalMs: number;
  createdAt: number;
};

const registry = new Map<ReturnType<typeof setInterval>, ITimerEntry>();

export function trackedSetInterval(
  source: string,
  fn: () => void,
  intervalMs: number,
): ReturnType<typeof setInterval> {
  const id = setInterval(fn, intervalMs);
  registry.set(id, { source, intervalMs, createdAt: Date.now() });
  return id;
}

export function clearTrackedInterval(
  id: ReturnType<typeof setInterval> | undefined | null,
): void {
  if (id === undefined || id === null) return;
  clearInterval(id);
  registry.delete(id);
}

export function getTimerCensus(): {
  totalLive: number;
  bySource: { source: string; count: number }[];
} {
  const counts = new Map<string, number>();
  for (const { source } of registry.values()) {
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  const bySource = Array.from(counts.entries())
    .map(([source, count]) => ({ source, count }))
    .toSorted((a, b) => b.count - a.count);
  return { totalLive: registry.size, bySource };
}
