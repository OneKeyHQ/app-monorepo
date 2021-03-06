import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';

const appEventBus = new CrossEventEmitter();

enum AppEventBusNames {
  AccountNameChanged = 'AccountNameChanged',
  NetworkChanged = 'NetworkChanged',
  AccountChanged = 'AccountChanged',
}

export { appEventBus, AppEventBusNames };
