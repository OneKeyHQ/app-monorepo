import type { TAccountSelectorPerfEventName } from './perf';

const ACCOUNT_SELECTOR_PERF_E2E_TRACE_LIMIT = 10_000;

type IAccountSelectorPerfE2ETrace = Record<string, unknown> & {
  event: TAccountSelectorPerfEventName;
};

const accountSelectorPerfE2ETraceBuffer: IAccountSelectorPerfE2ETrace[] = [];
let accountSelectorPerfE2EDroppedCount = 0;

// Keep the E2E controls separate from decorated logger classes so production
// callers do not pull development-only payload builders into the bundle.
// Web/desktop share this state between UI and background; split-runtime
// targets must configure attribution in each runtime separately.
let accountSelectorPerfE2EAttributionEnabled = true;

export function setAccountSelectorPerfE2EAttributionEnabled(enabled: boolean) {
  accountSelectorPerfE2EAttributionEnabled = enabled;
}

export function isAccountSelectorPerfE2EAttributionEnabled() {
  return accountSelectorPerfE2EAttributionEnabled;
}

export function recordAccountSelectorPerfE2ETrace(trace: unknown) {
  if (
    trace &&
    typeof trace === 'object' &&
    typeof (trace as IAccountSelectorPerfE2ETrace).event === 'string'
  ) {
    if (
      accountSelectorPerfE2ETraceBuffer.length >=
      ACCOUNT_SELECTOR_PERF_E2E_TRACE_LIMIT
    ) {
      const deleteCount = Math.floor(ACCOUNT_SELECTOR_PERF_E2E_TRACE_LIMIT / 5);
      accountSelectorPerfE2ETraceBuffer.splice(0, deleteCount);
      accountSelectorPerfE2EDroppedCount += deleteCount;
    }
    accountSelectorPerfE2ETraceBuffer.push({
      ...(trace as IAccountSelectorPerfE2ETrace),
    });
  }
}

export function drainAccountSelectorPerfE2ETrace() {
  const events = accountSelectorPerfE2ETraceBuffer.splice(0);
  const droppedCount = accountSelectorPerfE2EDroppedCount;
  accountSelectorPerfE2EDroppedCount = 0;
  return {
    droppedCount,
    events,
  };
}
