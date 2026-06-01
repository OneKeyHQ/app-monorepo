import { MAX_ALIVE_WEBVIEW_COUNT } from '../config/webviewAliveLimit';

import type { IWebTab } from '../types';

// Decide which tabs keep their WebView mounted (alive) using a recency LRU.
//
// Priority order (most likely to stay alive first):
//   1. the active tab (always alive)
//   2. most-recently-active tabs, per `mountOrder` (most-recent first)
//   3. any remaining tabs (older / never-activated) as a stable fallback
// We then keep only the first `max` of that ordered list. Everything else is
// evicted (its WebView unmounts) until it becomes active again.
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
  if (!Array.isArray(tabs) || tabs.length === 0 || max <= 0) {
    return alive;
  }

  const existingIds = new Set(tabs.map((t) => t.id));

  // Build the recency-ordered candidate list without duplicates.
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
  for (const t of tabs) {
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
