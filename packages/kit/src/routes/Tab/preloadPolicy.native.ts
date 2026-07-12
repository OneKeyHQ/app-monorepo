import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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

let hasLoggedDeviceCapability = false;

export function getTabPreloadPolicy(): ITabPreloadPolicy {
  const profile = getDevicePerformanceProfile();
  const decision = resolveNativeTabPreloadDecision({
    cpuTier: profile.cpu.tier,
    memoryClass: profile.memory.class,
  });
  if (!hasLoggedDeviceCapability) {
    hasLoggedDeviceCapability = true;
    defaultLogger.app.perf.deviceCapabilityDetected({
      cpuTier: profile.cpu.tier,
      cpuSource: profile.cpu.source,
      cpuConfidence: profile.cpu.confidence,
      memoryClass: profile.memory.class,
      tabPreloadMode: decision.mode,
      tabPreloadReason: decision.reason,
      dataVersion: profile.dataVersion,
    });
  }
  return {
    ...decision,
    ...getTabPreloadEntry(decision.mode),
  };
}
