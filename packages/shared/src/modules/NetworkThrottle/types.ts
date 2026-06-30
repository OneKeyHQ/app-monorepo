export type INativeNetworkThrottleProfile = 'slow4g';

export type INativeNetworkThrottleConfig = {
  enabled: boolean;
  profile: INativeNetworkThrottleProfile;
  latencyMs: number;
};

export const NATIVE_SLOW_4G_LATENCY_MS = 562.5;
