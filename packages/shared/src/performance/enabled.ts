export function isPerfMonitorEnabled(): boolean {
  try {
    return (
      typeof process !== 'undefined' && process.env.PERF_MONITOR_ENABLED === '1'
    );
  } catch {
    return false;
  }
}
