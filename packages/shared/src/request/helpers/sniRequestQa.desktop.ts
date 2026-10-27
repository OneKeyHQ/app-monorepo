import { OneKeyLocalError } from '../../errors';

import type { ISniRequestQaAdapter } from './sniRequestQa';

export const sniRequestQaAdapter: ISniRequestQaAdapter = {
  transportLabel: 'Electron main process',
  async clearDNSCache() {
    const proxy = globalThis.desktopApiProxy?.sniRequest;
    if (typeof proxy?.clearDNSCache !== 'function') {
      throw new OneKeyLocalError('Electron SNI DNS cache API is unavailable');
    }
    return proxy.clearDNSCache();
  },
  async getDebugSnapshot(target) {
    const proxy = globalThis.desktopApiProxy?.sniRequest;
    if (typeof proxy?.getDebugSnapshot !== 'function') {
      throw new OneKeyLocalError(
        'Electron SNI limiter snapshot API is unavailable',
      );
    }
    return proxy.getDebugSnapshot(target);
  },
};
