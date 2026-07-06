export type INativeNetworkThrottleProfile = 'slow4g';

export type INativeNetworkThrottleConfig = {
  enabled: boolean;
  profile: INativeNetworkThrottleProfile;
  latencyMs: number;
  downloadBps: number;
  uploadBps: number;
};

export const NETWORK_THROTTLE_SLOW_4G_LATENCY_MS = 562.5;
export const NETWORK_THROTTLE_102_KIB_BPS = 102 * 1024;
export const NETWORK_THROTTLE_SLOW_4G_DOWNLOAD_BPS =
  NETWORK_THROTTLE_102_KIB_BPS;
export const NETWORK_THROTTLE_SLOW_4G_UPLOAD_BPS = NETWORK_THROTTLE_102_KIB_BPS;

export const NATIVE_SLOW_4G_LATENCY_MS = NETWORK_THROTTLE_SLOW_4G_LATENCY_MS;
export const NATIVE_SLOW_4G_DOWNLOAD_BPS =
  NETWORK_THROTTLE_SLOW_4G_DOWNLOAD_BPS;
export const NATIVE_SLOW_4G_UPLOAD_BPS = NETWORK_THROTTLE_SLOW_4G_UPLOAD_BPS;
