import { getDevicePerformanceProfile } from '@onekeyhq/shared/src/performance/devicePerformanceTier';

import { getTabPreloadEntry } from './preloadConfig';
import {
  type ITabPreloadDecision,
  resolveNativeTabPreloadDecision,
} from './preloadPolicyResolver';

export interface ITabPreloadPolicy extends ITabPreloadDecision {
  queue: ReturnType<typeof getTabPreloadEntry>['queue'];
  intervalMs: number;
}

export function getTabPreloadPolicy(): ITabPreloadPolicy {
  const profile = getDevicePerformanceProfile();
  const decision = resolveNativeTabPreloadDecision({
    cpuTier: profile.cpu.tier,
    memoryClass: profile.memory.class,
  });
  return {
    ...decision,
    ...getTabPreloadEntry(decision.mode),
  };
}
