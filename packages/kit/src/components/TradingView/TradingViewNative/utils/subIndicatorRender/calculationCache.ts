import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { calculateTradingViewNativeSubIndicator } from './calculators';

import type {
  ITradingViewNativeSubIndicatorCalculation,
  ITradingViewNativeSubIndicatorResolvedInstance,
} from './types';

interface ITradingViewNativeSubIndicatorCalculationCacheEntry {
  calculation: ITradingViewNativeSubIndicatorCalculation;
  inputKey: string;
  points: readonly IMarketTokenKLineDataPoint[];
}

export interface ITradingViewNativeSubIndicatorCalculationCache {
  entries: Map<string, ITradingViewNativeSubIndicatorCalculationCacheEntry>;
}

export interface ITradingViewNativeSubIndicatorCalculationEntry {
  calculation: ITradingViewNativeSubIndicatorCalculation;
  instance: ITradingViewNativeSubIndicatorResolvedInstance;
}

export function createTradingViewNativeSubIndicatorCalculationCache(): ITradingViewNativeSubIndicatorCalculationCache {
  return { entries: new Map() };
}

function getCalculationInputKey(
  instance: ITradingViewNativeSubIndicatorResolvedInstance,
) {
  return JSON.stringify([instance.indicator, instance.settings.inputs]);
}

export function calculateTradingViewNativeSubIndicatorsWithCache({
  cache,
  instances,
  points,
}: {
  cache: ITradingViewNativeSubIndicatorCalculationCache;
  instances: readonly ITradingViewNativeSubIndicatorResolvedInstance[];
  points: readonly IMarketTokenKLineDataPoint[];
}): ITradingViewNativeSubIndicatorCalculationEntry[] {
  const activeInstanceIds = new Set<string>();
  const entries = instances.map((instance) => {
    activeInstanceIds.add(instance.id);
    const inputKey = getCalculationInputKey(instance);
    const cachedEntry = cache.entries.get(instance.id);
    const calculation =
      cachedEntry?.points === points && cachedEntry.inputKey === inputKey
        ? cachedEntry.calculation
        : calculateTradingViewNativeSubIndicator(instance, points);
    if (calculation !== cachedEntry?.calculation) {
      cache.entries.set(instance.id, { calculation, inputKey, points });
    }
    return { calculation, instance };
  });

  for (const instanceId of cache.entries.keys()) {
    if (!activeInstanceIds.has(instanceId)) {
      cache.entries.delete(instanceId);
    }
  }
  return entries;
}
