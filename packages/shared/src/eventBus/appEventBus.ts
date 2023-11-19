/* eslint-disable import/no-named-as-default-member */
import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';

import platformEnv from '../platformEnv';

export enum EAppEventBusNames {
  NetworkChanged = 'NetworkChanged',
  AccountChanged = 'AccountChanged',
  // AccountNameChanged = 'AccountNameChanged',
  // CurrencyChanged = 'CurrencyChanged',
  // BackupRequired = 'BackupRequired',
  // NotificationStatusChanged = 'NotificationStatusChanged',
  // StoreInitedFromPersistor = 'StoreInitedFromPersistor',
  // Unlocked = 'Unlocked',
  // HttpServerRequest = 'HttpServerRequest',
}

export interface IAppEventBusPayload {
  [EAppEventBusNames.AccountChanged]: {
    name: string;
    id: number;
  };
  [EAppEventBusNames.NetworkChanged]: undefined;
}

interface IAppEventBusBroadcastMethods {
  uiToBg?: (type: string, payload: any) => void;
  bgToUi?: (type: string, payload: any) => void;
}
class AppEventBus extends CrossEventEmitter {
  // TODO make to Promise object
  broadcastMethods: IAppEventBusBroadcastMethods | undefined;

  registerBroadcastMethods(methods: IAppEventBusBroadcastMethods) {
    this.broadcastMethods = {
      ...this.broadcastMethods,
      ...methods,
    };
  }

  get shouldEmitToSelf() {
    return (
      !platformEnv.isExtensionOffscreen &&
      !platformEnv.isExtensionUi &&
      !platformEnv.isWebEmbed
    );
  }

  override emit<T extends EAppEventBusNames>(
    type: T,
    payload: IAppEventBusPayload[T],
  ): boolean {
    if (this.shouldEmitToSelf) {
      this.emitToSelf(type, payload);
    }
    this.emitToRemote(type, payload);
    return true;
  }

  emitToSelf(type: EAppEventBusNames, ...args: any[]) {
    super.emit(type, ...args);
    return true;
  }

  emitToRemote(type: string, payload: any) {
    if (!this.broadcastMethods) {
      throw new Error('broadcastMethods not registerred');
    }
    if (platformEnv.isExtensionOffscreen || platformEnv.isWebEmbed) {
      // request background
      throw new Error('offscreen or webembed event bus not support yet.');
    }
    if (platformEnv.isNative) {
      // requestToWebEmbed
    }
    // eslint-disable-next-line import/no-named-as-default-member
    if (platformEnv.isExtensionUi) {
      // request background
      return this.broadcastMethods.uiToBg?.(type, payload);
    }
    // eslint-disable-next-line import/no-named-as-default-member
    if (platformEnv.isExtensionBackground) {
      // requestToOffscreen
      // requestToAllUi
      return this.broadcastMethods.bgToUi?.(type, payload);
    }
  }
}
const appEventBus = new AppEventBus();

// appEventBus.emit(EAppEventBusNames.AccountChanged, { name: '1,', id: 1 });
// appEventBus.emit(EAppEventBusNames.NetworkChanged, undefined);

if (process.env.NODE_ENV !== 'production') {
  global.$$appEventBus = appEventBus;
}

export { appEventBus };
