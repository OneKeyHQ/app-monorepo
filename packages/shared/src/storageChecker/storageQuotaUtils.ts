const BYTES_PER_GB = 1024 * 1024 * 1024;

function toGB(bytes: number): number {
  return bytes / BYTES_PER_GB;
}

/**
 * Locale-independent size rendering. Only the numeric formatting lives here;
 * labelling and layout belong to the UI layer, which owns localization.
 */
function formatGB(bytes: number): string {
  const gb = toGB(bytes);
  // Sub-100MB headroom is the interesting range when diagnosing a full quota,
  // so keep more precision there instead of collapsing everything to "0.0 GB".
  return `${gb < 0.1 ? gb.toFixed(3) : gb.toFixed(1)} GB`;
}

export default {
  toGB,
  formatGB,
};
