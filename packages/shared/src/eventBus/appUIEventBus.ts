import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';

import { isExtensionBackground } from '../platformEnv';

// eslint-disable-next-line import/no-mutable-exports
let appUIEventBus: CrossEventEmitter;

enum AppUIEventBusNames {
  SwapCompleted = 'SwapCompleted',
  SwapError = 'SwapError',
  RemoveAccount = 'RemoveAccount',
}

if (isExtensionBackground) {
  appUIEventBus = new Proxy(
    {},
    {
      get() {
        throw new Error(
          '[appEventBus] is NOT allowed in Extension Background process currently.',
        );
      },
    },
  ) as CrossEventEmitter;
} else {
  appUIEventBus = new CrossEventEmitter();
}

if (process.env.NODE_ENV !== 'production') {
  global.$$appUIEventBus = appUIEventBus;
}

export { appUIEventBus, AppUIEventBusNames };
