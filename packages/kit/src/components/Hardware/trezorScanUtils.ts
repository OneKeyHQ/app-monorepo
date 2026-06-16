export const TREZOR_SCAN_MAX_TRY_COUNT = 14;
export const TREZOR_SCAN_POLL_INTERVAL_MS = 1500;

export function shouldShowTrezorScanTimeout({
  pollsCompleted,
  deviceCount,
}: {
  pollsCompleted: number;
  deviceCount: number;
}) {
  return pollsCompleted >= TREZOR_SCAN_MAX_TRY_COUNT && deviceCount === 0;
}
