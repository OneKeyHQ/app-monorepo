import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';

import { isExtensionUi } from '../platformEnv';

const appEventBus = new CrossEventEmitter();

enum AppEventBusNames {
  AccountNameChanged = 'AccountNameChanged',
  NetworkChanged = 'NetworkChanged',
  AccountChanged = 'AccountChanged',
  BackupRequired = 'BackupRequired',
}

if (isExtensionUi) {
  throw new Error('[appEventBus] is NOT allowed in UI process currently.');
}

export { appEventBus, AppEventBusNames };
