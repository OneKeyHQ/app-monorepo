import { totalMemory } from 'expo-device';

// Native cap on simultaneously-mounted DApp WebViews, tiered by device RAM.
// Each live WebView carries its own renderer process (WKWebView WebContent on
// iOS, a sandboxed renderer on Android), so low-memory devices must keep fewer
// alive to avoid jetsam/OOM kills. See ./webviewAliveLimit.ts for the rationale.
const GB = 1024 * 1024 * 1024;

function resolveMaxAliveWebViewCount(): number {
  const mem = typeof totalMemory === 'number' ? totalMemory : 0;
  if (mem <= 0) {
    // Unknown RAM → stay conservative.
    return 3;
  }
  if (mem <= 3 * GB) {
    return 3; // low-end
  }
  if (mem <= 6 * GB) {
    return 5; // mid-range
  }
  return 6; // high-end
}

export const MAX_ALIVE_WEBVIEW_COUNT = resolveMaxAliveWebViewCount();
