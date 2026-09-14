import { NativeModules } from 'react-native';

import { OneKeyLocalError } from '../../errors';

import {
  normalizeNetworkThrottleConfig,
  setNetworkThrottleRuntimeConfig,
} from './runtimeState';
import { NETWORK_THROTTLE_ONEKEY_HOSTS } from './throttledHosts';

import type { INativeNetworkThrottleConfig } from './types';
import type { NetworkThrottleConfig as INetworkThrottleModuleConfig } from '@onekeyfe/react-native-network-throttle';

export type {
  INativeNetworkThrottleConfig,
  INativeNetworkThrottleProfile,
} from './types';
export { NATIVE_SLOW_4G_LATENCY_MS } from './types';
export {
  getNetworkThrottleRuntimeConfig,
  setNetworkThrottleRuntimeConfig,
} from './runtimeState';

// Older native binaries (< 3.0.84) do not report throttleUrlHosts, and JS
// bundle updates can run against them, so the raw module response must not
// claim the field is always present.
type INativeModuleNetworkThrottleResponse = Omit<
  INetworkThrottleModuleConfig,
  'throttleUrlHosts'
> & {
  throttleUrlHosts?: string[];
};

type IOneKeyNetworkThrottleNativeModule = {
  getConfig: () => Promise<INativeModuleNetworkThrottleResponse>;
  setConfig: (
    config: Partial<INetworkThrottleModuleConfig>,
  ) => Promise<INativeModuleNetworkThrottleResponse>;
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
    const nativeConfig = await getNativeModule().setConfig({
      ...nextConfig,
      // Only OneKey's own traffic is throttled; the local dev server is simply
      // not on the allowlist, so Metro bundles and assets stay at full speed.
      throttleUrlHosts: [...NETWORK_THROTTLE_ONEKEY_HOSTS],
    });
    return setNetworkThrottleRuntimeConfig(nativeConfig);
  },
};

export default nativeNetworkThrottle;
