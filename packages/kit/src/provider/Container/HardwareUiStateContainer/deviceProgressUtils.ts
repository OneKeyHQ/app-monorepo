export function normalizeDeviceProgress(progress: number | undefined) {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  return Math.min(100, Math.max(0, progress ?? 0));
}
