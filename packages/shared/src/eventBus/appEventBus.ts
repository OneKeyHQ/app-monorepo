import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';

import { isExtensionUi } from '../platformEnv';

// eslint-disable-next-line import/no-mutable-exports
let appEventBus: CrossEventEmitter;

enum AppEventBusNames {
  AccountNameChanged = 'AccountNameChanged',
  NetworkChanged = 'NetworkChanged',
  AccountChanged = 'AccountChanged',
  BackupRequired = 'BackupRequired',
  NotificationStatusChanged = 'NotificationStatusChanged',
  StoreInitedFromPersistor = 'StoreInitedFromPersistor',
}

if (isExtensionUi) {
  appEventBus = new Proxy(
    {},
    {
      get() {
        throw new Error(
          '[appEventBus] is NOT allowed in UI process currently.',
        );
      },
    },
  ) as CrossEventEmitter;
} else {
  appEventBus = new CrossEventEmitter();
}

if (process.env.NODE_ENV !== 'production') {
  global.$appEventBus = appEventBus;
}

export { appEventBus, AppEventBusNames };
