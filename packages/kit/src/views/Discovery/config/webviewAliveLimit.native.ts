import {
  getDeviceMemoryGBSync,
  isLowEndMemory,
} from '@onekeyhq/shared/src/performance/deviceMemory';
import { resolveMemoryClass } from '@onekeyhq/shared/src/performance/devicePerformanceTierResolver';
import { EDeviceMemoryClass } from '@onekeyhq/shared/src/performance/devicePerformanceTierTypes';

// Native cap on simultaneously-mounted DApp WebViews, tiered by device RAM.
// Each live WebView carries its own renderer process (WKWebView WebContent on
// iOS, a sandboxed renderer on Android), so low-memory devices must keep fewer
// alive to avoid jetsam/OOM kills. See ./webviewAliveLimit.ts for the rationale.
//
// RAM and the constrained-memory predicate come from shared capability code so
// this cap and the cold-start guard agree on low-memory devices.

function resolveMaxAliveWebViewCount(): number {
  const memGB = getDeviceMemoryGBSync();
  const memoryClass = resolveMemoryClass({
    memoryGB: memGB,
    isMemoryConstrained: memGB !== null ? isLowEndMemory(memGB) : false,
  });
  if (memoryClass === EDeviceMemoryClass.large) {
    return 6;
  }
  if (memoryClass === EDeviceMemoryClass.standard) {
    return 5;
  }
  // Unknown or constrained memory stays conservative.
  return 3;
}

export const MAX_ALIVE_WEBVIEW_COUNT = resolveMaxAliveWebViewCount();
