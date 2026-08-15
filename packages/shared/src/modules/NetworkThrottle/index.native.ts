import { NativeModules } from 'react-native';

import { OneKeyLocalError } from '../../errors';

import { getNetworkThrottleDevServerOrigin } from './devServerPolicy';
import {
  normalizeNetworkThrottleConfig,
  setNetworkThrottleRuntimeConfig,
} from './runtimeState';

import type { INativeNetworkThrottleConfig } from './types';
import type { NetworkThrottleConfig as INetworkThrottleModuleConfig } from '@onekeyfe/react-native-network-throttle';

type INativeSourceCodeModule = {
  getConstants?: () => {
    scriptURL?: unknown;
  };
};

export type {
  INativeNetworkThrottleConfig,
  INativeNetworkThrottleProfile,
} from './types';
export { NATIVE_SLOW_4G_LATENCY_MS } from './types';
export {
  getNetworkThrottleRuntimeConfig,
  setNetworkThrottleRuntimeConfig,
} from './runtimeState';

// Older native binaries (< 3.0.82) omit bypassUrlOrigins, and JS bundle
// updates can run against them, so the raw module response must not claim
// the field is always present.
type INativeModuleNetworkThrottleResponse = Omit<
  INetworkThrottleModuleConfig,
  'bypassUrlOrigins'
> & {
  bypassUrlOrigins?: string[];
};

type IOneKeyNetworkThrottleNativeModule = {
  getConfig: () => Promise<INativeModuleNetworkThrottleResponse>;
  setConfig: (
    config: Partial<INetworkThrottleModuleConfig>,
  ) => Promise<INativeModuleNetworkThrottleResponse>;
};

function getDevServerBypassOrigins(): string[] | undefined {
  const sourceCodeModule = NativeModules.SourceCode as
    | INativeSourceCodeModule
    | undefined;
  const scriptURL = sourceCodeModule?.getConstants?.()?.scriptURL;
  const origin = getNetworkThrottleDevServerOrigin(scriptURL);
  return origin ? [origin] : undefined;
}

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
    const bypassUrlOrigins = getDevServerBypassOrigins();
    const nativeConfig = await getNativeModule().setConfig({
      ...nextConfig,
      ...(bypassUrlOrigins ? { bypassUrlOrigins } : undefined),
    });
    return setNetworkThrottleRuntimeConfig(nativeConfig);
  },
};

export default nativeNetworkThrottle;
