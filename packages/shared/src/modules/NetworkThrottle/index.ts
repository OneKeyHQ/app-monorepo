import {
  getNetworkThrottleRuntimeConfig,
  setNetworkThrottleRuntimeConfig,
} from './runtimeState';
import { NATIVE_SLOW_4G_LATENCY_MS } from './types';

import type { INativeNetworkThrottleConfig } from './types';

export type {
  INativeNetworkThrottleConfig,
  INativeNetworkThrottleProfile,
} from './types';
export { NATIVE_SLOW_4G_LATENCY_MS } from './types';
export {
  getNetworkThrottleRuntimeConfig,
  setNetworkThrottleRuntimeConfig,
} from './runtimeState';

const disabledConfig: INativeNetworkThrottleConfig = {
  enabled: false,
  profile: 'slow4g',
  latencyMs: NATIVE_SLOW_4G_LATENCY_MS,
};

const nativeNetworkThrottle = {
  async getNetworkThrottle(): Promise<INativeNetworkThrottleConfig> {
    return getNetworkThrottleRuntimeConfig();
  },

  async setNetworkThrottle(
    config: Partial<INativeNetworkThrottleConfig>,
  ): Promise<INativeNetworkThrottleConfig> {
    if (config.enabled) {
      return disabledConfig;
    }
    return setNetworkThrottleRuntimeConfig(config);
  },
};

export default nativeNetworkThrottle;
