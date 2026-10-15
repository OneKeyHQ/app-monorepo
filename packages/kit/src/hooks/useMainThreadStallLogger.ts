import { useEffect } from 'react';

import {
  isPrivacyChainPerfLogEnabled,
  privacyChainPerfLog,
} from '@onekeyhq/shared/src/utils/privacyChainPerfLog';

const PROBE_INTERVAL_MS = 100;
const STALL_THRESHOLD_MS = 150;

// Temporary UI-thread stall probe: a timer that should fire every 100ms
// reports how late it was when something blocked the JS thread. Paired with
// the [PRIV-PERF] background/carrier logs it shows which step the stall
// lines up with. Dev only.
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
