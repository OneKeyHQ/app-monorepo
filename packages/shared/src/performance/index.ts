export default {
  start: (_intervalMs: number) => {},
  stop: () => {},
  showOverlay: () => {},
  hideOverlay: () => {},
  sample: async () => ({ cpu: 0, rss: 0, timestamp: Date.now() }),
};
