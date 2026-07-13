import { modelId } from 'expo-device';

import { getIosDeviceCpuTier } from './deviceCpuTierData/ios';
import { normalizeDeviceCpuTierKeyPart } from './deviceCpuTierUtils';

import type { IDeviceCpuTierMatch } from './devicePerformanceTierTypes';

export function getDeviceCpuTierMatch(): IDeviceCpuTierMatch | null {
  const normalizedModelId = normalizeDeviceCpuTierKeyPart(modelId);
  const modelIdTier = normalizedModelId
    ? getIosDeviceCpuTier(normalizedModelId)
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
