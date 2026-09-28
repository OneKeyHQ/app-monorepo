import { useMemo, useSyncExternalStore } from 'react';

import { overlayStore } from './OverlayStore';

/**
 * Owners whose page overlays in `hostKey` must be hidden. The page host
 * applies this natively: the owning page may be frozen (freezeOnBlur) and
 * cannot re-render its own overlays.
 */
export function useSuspendedPageOwners(hostKey: string): string[] {
  const snapshot = useSyncExternalStore(
    overlayStore.subscribe,
    overlayStore.getSnapshot,
    overlayStore.getSnapshot,
  );
  const joined = snapshot.entries
    .filter((e) => e.scope === 'page' && e.hostKey === hostKey && e.suspended)
    .map((e) => e.ownerKey ?? '')
    .filter(Boolean)
    .toSorted()
    .join('\n');
  return useMemo(
    () => (joined ? [...new Set(joined.split('\n'))] : []),
    [joined],
  );
}
