import { manufacturer, modelName } from 'expo-device';

import { getAndroidDeviceCpuTier } from './deviceCpuTierData/android';
import { normalizeDeviceCpuTierKeyPart } from './deviceCpuTierUtils';
import { isKnownDeviceCpuTier } from './devicePerformanceTierTypes';

import type { IDeviceCpuTierMatch } from './devicePerformanceTierTypes';

export function getDeviceCpuTierMatch(): IDeviceCpuTierMatch | null {
  const normalizedManufacturer = normalizeDeviceCpuTierKeyPart(manufacturer);
  const normalizedModel = normalizeDeviceCpuTierKeyPart(modelName);
  if (!normalizedManufacturer || !normalizedModel) {
    return null;
  }
  const tier = getAndroidDeviceCpuTier({
    manufacturer: normalizedManufacturer,
    model: normalizedModel,
  });
  if (!isKnownDeviceCpuTier(tier)) {
    return null;
  }
  return {
    tier,
    source: 'androidModel',
    confidence: 'medium',
  };
}
