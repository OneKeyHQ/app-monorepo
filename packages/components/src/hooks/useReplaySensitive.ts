import { useLayoutEffect } from 'react';

import { acquireReplayPause } from '@onekeyhq/shared/src/modules3rdParty/posthog/replayGate';

// Pauses Session Replay while `active` and the component is mounted. The
// layout effect runs during the commit that first renders the content, before
// paint and before a DOM MutationObserver callback. A no-op until a replay
// controller is registered.
export function useReplaySensitive(active = true, tag = 'sensitive'): void {
  useLayoutEffect(() => {
    if (!active) {
      return undefined;
    }
    return acquireReplayPause(tag);
  }, [active, tag]);
}
