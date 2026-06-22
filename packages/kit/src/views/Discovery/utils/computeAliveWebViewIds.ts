import { MAX_ALIVE_WEBVIEW_COUNT } from '../config/webviewAliveLimit';

import type { IWebTab } from '../types';

// Decide which tabs keep their WebView mounted (alive) using a recency LRU.
//
// Only URL-bearing tabs are considered: home/new-tab entries (`url: ''`, created
// by addBrowserHomeTab / addBlankWebTab) never mount a WebView — both
// Desktop/MobileBrowserContent gate on `Boolean(tab?.url)` — so they must NOT
// consume a keep-alive slot, otherwise `max` would evict real DApp WebViews
// earlier than configured (e.g. an active URL-less start tab would waste a slot).
//
// Priority order (most likely to stay alive first):
//   1. the active tab (always alive, when it has a URL)
//   2. most-recently-active tabs, per `mountOrder` (most-recent first)
//   3. any remaining URL tabs (older / never-activated) as a stable fallback
// We then keep only the first `max` of that ordered list. Everything else is
// evicted (its WebView unmounts) until it becomes active again.
//
// In-flight DApp request safety: evicting a tab unmounts its WebView, so an
// in-flight bridge response could no longer reach it. This is safe because:
//   - The active tab is ALWAYS alive (rule 1), and a tab can only be evicted
//     after the user activates `max` OTHER tabs, pushing it out of the window.
//   - DApp approval requests (connect/sign/tx) open a root modal
//     (EModalRoutes.DAppConnectionModal) presented over the whole app, so the
//     tab switcher is unreachable until the modal is resolved — the requesting
//     tab cannot be evicted while its approval is pending.
//   - Silent background RPCs (e.g. eth_call) on an evicted tab simply replay
//     when the tab reloads on revisit; the connection auto-restores by origin.
export function computeAliveWebViewIds({
  tabs,
  activeTabId,
  mountOrder,
  max = MAX_ALIVE_WEBVIEW_COUNT,
}: {
  tabs: IWebTab[];
  activeTabId: string | null;
  mountOrder: string[];
  max?: number;
}): Set<string> {
  const alive = new Set<string>();
  if (!Array.isArray(tabs) || max <= 0) {
    return alive;
  }

  // Only tabs that actually mount a WebView (have a URL) count toward the LRU
  // budget; URL-less home/new-tab entries are excluded entirely.
  const liveTabs = tabs.filter((t) => Boolean(t.url));
  if (liveTabs.length === 0) {
    return alive;
  }
  const existingIds = new Set(liveTabs.map((t) => t.id));

  // Build the recency-ordered candidate list without duplicates. `existingIds`
  // only holds URL-bearing ids, so a URL-less active tab / mountOrder entry is
  // naturally skipped here.
  const ordered: string[] = [];
  const pushUnique = (id?: string | null) => {
    if (id && existingIds.has(id) && !alive.has(id) && !ordered.includes(id)) {
      ordered.push(id);
    }
  };

  pushUnique(activeTabId);
  for (const id of mountOrder) {
    pushUnique(id);
  }
  // Stable fallback so tabs never activated (e.g. restored on launch) still
  // resolve deterministically instead of depending on Set iteration order.
  for (const t of liveTabs) {
    pushUnique(t.id);
  }

  for (const id of ordered) {
    if (alive.size >= max) {
      break;
    }
    alive.add(id);
  }

  return alive;
}
