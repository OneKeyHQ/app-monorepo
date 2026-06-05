// Dedicated ready gate for the web/desktop cold-start hydration path,
// kept independent of `globalJotaiStorageReadyHandler` (resolved at the end
// of `jotaiInit`) so changing this gate cannot regress native/extension
// boot semantics that depend on the existing handler.

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// Discriminated union describing the terminal state of cold-start hydration.
// 'success' means at least one L1/L2 entry was primed from IDB; the rest are
// non-success paths where the runtime fell back to atom defaults. 'skipped'
// is a deliberate no-op (dev mode), distinct from the 'error' failure bucket.
export type IColdStartHydrationStatus =
  | 'success'
  | 'timeout'
  | 'error'
  | 'killed'
  | 'skipped';

class ColdStartHydrationReadyHandler {
  isReady = false;

  // True iff hydration primed L1 or L2 from a non-empty IDB snapshot. Stays
  // false on timeout / error / kill-switch / first-install paths. Consumed
  // by telemetry, not by the render gate (the gate always releases).
  didHydrate = false;

  status: IColdStartHydrationStatus = 'error';

  resolveReady: (didHydrate: boolean) => void = () => {
    throw new OneKeyLocalError(
      'globalColdStartHydrationReadyHandler.resolveReady called before init',
    );
  };

  ready: Promise<boolean> = new Promise<boolean>((resolve) => {
    this.resolveReady = (didHydrate: boolean) => {
      this.didHydrate = didHydrate;
      this.isReady = true;
      resolve(didHydrate);
    };
  });
}

export const globalColdStartHydrationReadyHandler =
  new ColdStartHydrationReadyHandler();
