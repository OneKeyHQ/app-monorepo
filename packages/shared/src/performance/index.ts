export default {
  start: (_intervalMs: number) => {},
  stop: () => {},
  showOverlay: () => {},
  hideOverlay: () => {},
  sample: async () => ({ cpu: 0, rss: 0, timestamp: Date.now() }),
  // Web/desktop have no native memory-warning path. Returning `-1` lets
  // callers safely skip removal without branching on platform.
  addMemoryWarningListener: (
    _callback: (event: {
      level: 'low' | 'critical';
      rss: number;
      timestamp: number;
    }) => void,
  ): number => -1,
  removeMemoryWarningListener: (_id: number) => {},
  forceGarbageCollection: (): boolean => false,
};
