// Dedicated ready gate for the web/desktop cold-start hydration path,
// kept independent of `globalJotaiStorageReadyHandler` (resolved at the end
// of `jotaiInit`) so changing this gate cannot regress native/extension
// boot semantics that depend on the existing handler.

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

class ColdStartHydrationReadyHandler {
  isReady = false;

  resolveReady: (value: boolean) => void = () => {
    throw new OneKeyLocalError(
      'globalColdStartHydrationReadyHandler.resolveReady called before init',
    );
  };

  ready: Promise<boolean> = new Promise<boolean>((resolve) => {
    this.resolveReady = (value: boolean) => {
      this.isReady = true;
      resolve(value);
    };
  });
}

export const globalColdStartHydrationReadyHandler =
  new ColdStartHydrationReadyHandler();
