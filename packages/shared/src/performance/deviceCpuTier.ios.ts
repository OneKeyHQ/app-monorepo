import { modelId } from 'expo-device';

import { IOS_DEVICE_CPU_TIER_BY_MODEL_ID } from './deviceCpuTierData/ios';
import { normalizeDeviceCpuTierKeyPart } from './deviceCpuTierUtils';

import type { IDeviceCpuTierMatch } from './devicePerformanceTierTypes';

export function getDeviceCpuTierMatch(): IDeviceCpuTierMatch | null {
  const normalizedModelId = normalizeDeviceCpuTierKeyPart(modelId);
  const modelIdTier = normalizedModelId
    ? IOS_DEVICE_CPU_TIER_BY_MODEL_ID[normalizedModelId]
    : undefined;
  if (modelIdTier !== undefined) {
    return {
      tier: modelIdTier,
      source: 'iosModelId',
      confidence: 'high',
    };
  }

  return null;
}
