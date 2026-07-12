import { modelId, modelName } from 'expo-device';

import { IOS_DEVICE_CPU_TIER_BY_MODEL } from './deviceCpuTierData/ios';
import { normalizeDeviceCpuTierKeyPart } from './deviceCpuTierUtils';

import type { IDeviceCpuTierMatch } from './devicePerformanceTierTypes';

export function getDeviceCpuTierMatch(): IDeviceCpuTierMatch | null {
  const normalizedModelId = normalizeDeviceCpuTierKeyPart(modelId);
  const modelIdTier = normalizedModelId
    ? IOS_DEVICE_CPU_TIER_BY_MODEL[normalizedModelId]
    : undefined;
  if (modelIdTier !== undefined) {
    return {
      tier: modelIdTier,
      source: 'iosModelId',
      confidence: 'high',
    };
  }

  const normalizedModelName = normalizeDeviceCpuTierKeyPart(modelName);
  const modelNameTier = normalizedModelName
    ? IOS_DEVICE_CPU_TIER_BY_MODEL[normalizedModelName]
    : undefined;
  if (modelNameTier !== undefined) {
    return {
      tier: modelNameTier,
      source: 'iosModelName',
      confidence: 'high',
    };
  }

  return null;
}
