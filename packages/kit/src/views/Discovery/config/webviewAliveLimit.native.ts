import {
  getDeviceMemoryGBSync,
  isLowEndMemory,
} from '@onekeyhq/shared/src/performance/deviceMemory';

// Native cap on simultaneously-mounted DApp WebViews, tiered by device RAM.
// Each live WebView carries its own renderer process (WKWebView WebContent on
// iOS, a sandboxed renderer on Android), so low-memory devices must keep fewer
// alive to avoid jetsam/OOM kills. See ./webviewAliveLimit.ts for the rationale.
//
// RAM and the low-end classification both come from the shared device-memory
// module so this cap can never disagree with the perf tier / cold-start guard
// on which devices are low-end.

// Upper bound of the mid-range tier (GB). Devices above this are flagships.
const MID_MEM_THRESHOLD_GB = 6;

function resolveMaxAliveWebViewCount(): number {
  const memGB = getDeviceMemoryGBSync();
  if (memGB === null || memGB <= 0) {
    // Unknown RAM → stay conservative.
    return 3;
  }
  // Shares the jetsam low-end classification so a device the cold-start guard
  // treats as low-end (e.g. iPhone 7 Plus ~3.14GB) keeps the fewest WebViews
  // alive instead of being bumped into the mid tier.
  if (isLowEndMemory(memGB)) {
    return 3; // low-end
  }
  if (memGB <= MID_MEM_THRESHOLD_GB) {
    return 5; // mid-range
  }
  return 6; // high-end
}

export const MAX_ALIVE_WEBVIEW_COUNT = resolveMaxAliveWebViewCount();
