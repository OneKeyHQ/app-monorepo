import type { IStorageFullDiagnostics, IStorageQuotaInfo } from './types';

const BYTES_PER_GB = 1024 * 1024 * 1024;

function toGB(bytes: number): number {
  return bytes / BYTES_PER_GB;
}

function formatGB(bytes: number): string {
  const gb = toGB(bytes);
  // Sub-100MB headroom is the interesting range when diagnosing a full quota,
  // so keep more precision there instead of collapsing everything to "0.0 GB".
  return `${gb < 0.1 ? gb.toFixed(3) : gb.toFixed(1)} GB`;
}

/**
 * Language-neutral one-liner rendered inside the disk-full dialog. It lets a
 * user (or a support engineer reading a screenshot) tell a real quota
 * exhaustion apart from a write that failed for some other reason, which the
 * translated copy alone cannot express.
 */
function formatDiagnosticsDetail(
  diagnostics: IStorageFullDiagnostics | undefined,
): string | undefined {
  if (!diagnostics) {
    return undefined;
  }
  const lines: string[] = [];
  const quotaInfo: IStorageQuotaInfo | undefined = diagnostics.quotaInfo;
  if (quotaInfo) {
    lines.push(
      [
        `Quota ${formatGB(quotaInfo.quotaBytes)}`,
        `Used ${formatGB(quotaInfo.usageBytes)}`,
        `Free ${formatGB(quotaInfo.availableBytes)}`,
      ].join(' · '),
    );
  }
  lines.push(`Reason: ${diagnostics.reason}`);
  if (diagnostics.errorMessage) {
    lines.push(`Error: ${diagnostics.errorMessage}`);
  }
  return lines.join('\n');
}

export default {
  toGB,
  formatGB,
  formatDiagnosticsDetail,
};
