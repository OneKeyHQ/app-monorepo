// Enable only in local account-switch regression builds, then rebuild both
// native JS bundles. See apps/mobile/e2e/account-switch-heating-repro.md.
const ACCOUNT_SWITCH_DIAGNOSTICS_ENABLED = false;

export function isAccountSwitchDiagnosticsEnabled(): boolean {
  return ACCOUNT_SWITCH_DIAGNOSTICS_ENABLED;
}

export function isPerfMonitorEnabled(): boolean {
  try {
    return (
      typeof process !== 'undefined' && process.env.PERF_MONITOR_ENABLED === '1'
    );
  } catch {
    return false;
  }
}
