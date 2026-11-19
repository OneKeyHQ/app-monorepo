import { modelId } from 'expo-device';

import {
  getIosDeviceCpuTier,
  isIosModelIdNewerThanCatalog,
} from './deviceCpuTierData/ios';
import { normalizeDeviceCpuTierKeyPart } from './deviceCpuTierUtils';
import { EDeviceCpuTier } from './devicePerformanceTierTypes';

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

  // Newer than anything the catalog ranks: treat as high rather than unknown,
  // which would drop the newest hardware to the most conservative policy.
  // Medium confidence, and a distinct source so logs and analytics can still
  // tell an inferred tier from a ranked one.
  if (normalizedModelId && isIosModelIdNewerThanCatalog(normalizedModelId)) {
    return {
      tier: EDeviceCpuTier.high,
      source: 'iosModelIdNewerThanCatalog',
      confidence: 'medium',
    };
  }

  return null;
}
