import { NativeModules } from 'react-native';

import { OneKeyLocalError } from '../../errors';

import {
  normalizeNetworkThrottleConfig,
  setNetworkThrottleRuntimeConfig,
} from './runtimeState';

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

type IOneKeyNetworkThrottleNativeModule = {
  getConfig: () => Promise<INativeNetworkThrottleConfig>;
  setConfig: (
    config: Partial<INativeNetworkThrottleConfig>,
  ) => Promise<INativeNetworkThrottleConfig>;
};

function getNativeModule(): IOneKeyNetworkThrottleNativeModule {
  const nativeModule = NativeModules.OneKeyNetworkThrottle as
    | IOneKeyNetworkThrottleNativeModule
    | undefined;
  if (!nativeModule) {
    throw new OneKeyLocalError(
      'OneKeyNetworkThrottle native module is unavailable',
    );
  }
  return nativeModule;
}

const nativeNetworkThrottle = {
  async getNetworkThrottle(): Promise<INativeNetworkThrottleConfig> {
    const config = await getNativeModule().getConfig();
    return setNetworkThrottleRuntimeConfig(config);
  },

  async setNetworkThrottle(
    config: Partial<INativeNetworkThrottleConfig>,
  ): Promise<INativeNetworkThrottleConfig> {
    const nextConfig = normalizeNetworkThrottleConfig(config);
    const nativeConfig = await getNativeModule().setConfig(nextConfig);
    return setNetworkThrottleRuntimeConfig(nativeConfig);
  },
};

export default nativeNetworkThrottle;
