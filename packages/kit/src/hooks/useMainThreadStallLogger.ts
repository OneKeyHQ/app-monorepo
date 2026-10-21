import { useEffect } from 'react';

import {
  isPrivacyChainPerfLogEnabled,
  privacyChainPerfLog,
} from '@onekeyhq/shared/src/utils/privacyChainPerfLog';

const PROBE_INTERVAL_MS = 100;
const STALL_THRESHOLD_MS = 150;

// UI-thread stall probe: logs how late a 100ms timer fires, to line stalls up
// with the [PRIV-PERF] background logs.
export function useMainThreadStallLogger(scope: string) {
  useEffect(() => {
    if (!isPrivacyChainPerfLogEnabled()) {
      return undefined;
    }
    let expectedAt = Date.now() + PROBE_INTERVAL_MS;
    const timer = setInterval(() => {
      const now = Date.now();
      const lagMs = now - expectedAt;
      if (lagMs >= STALL_THRESHOLD_MS) {
        privacyChainPerfLog('ui-stall', { scope, lagMs });
      }
      expectedAt = now + PROBE_INTERVAL_MS;
    }, PROBE_INTERVAL_MS);
    privacyChainPerfLog('ui-stall-probe start', { scope });
    return () => {
      clearInterval(timer);
      privacyChainPerfLog('ui-stall-probe stop', { scope });
    };
  }, [scope]);
}
