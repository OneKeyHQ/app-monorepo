import { manufacturer, modelName } from 'expo-device';

import { ANDROID_DEVICE_CPU_TIER_BY_KEY } from './deviceCpuTierData/android';
import { buildAndroidDeviceCpuTierKey } from './deviceCpuTierUtils';

import type { IDeviceCpuTierMatch } from './devicePerformanceTierTypes';

export function getDeviceCpuTierMatch(): IDeviceCpuTierMatch | null {
  const key = buildAndroidDeviceCpuTierKey({
    manufacturer,
    model: modelName,
  });
  const tier = key ? ANDROID_DEVICE_CPU_TIER_BY_KEY[key] : undefined;
  if (tier === undefined) {
    return null;
  }
  return {
    tier,
    source: 'androidModel',
    confidence: 'medium',
  };
}
