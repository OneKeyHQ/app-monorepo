import {
  EDevicePerformanceTier,
  getDevicePerformanceTier,
} from '@onekeyhq/shared/src/performance/devicePerformanceTier';

import { getTabPreloadEntry } from './preloadConfig';
import {
  ETabPreloadMode,
  type ITabPreloadDecision,
  type ITabPreloadReason,
} from './preloadPolicyResolver';

const LEGACY_DECISION_BY_TIER: Record<
  EDevicePerformanceTier,
  ITabPreloadDecision
> = {
  [EDevicePerformanceTier.high]: {
    mode: ETabPreloadMode.full,
    reason: 'legacy-high',
  },
  [EDevicePerformanceTier.medium]: {
    mode: ETabPreloadMode.light,
    reason: 'legacy-medium',
  },
  [EDevicePerformanceTier.low]: {
    mode: ETabPreloadMode.disabled,
    reason: 'legacy-low',
  },
};

export interface ITabPreloadPolicy {
  mode: ETabPreloadMode;
  reason: ITabPreloadReason;
  queue: ReturnType<typeof getTabPreloadEntry>['queue'];
  intervalMs: number;
}

export function getTabPreloadPolicy(): ITabPreloadPolicy {
  const decision = LEGACY_DECISION_BY_TIER[getDevicePerformanceTier()];
  return {
    ...decision,
    ...getTabPreloadEntry(decision.mode),
  };
}
