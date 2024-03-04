/* eslint-disable import/no-named-as-default-member */
import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

import platformEnv from '../platformEnv';

import type { EAccountSelectorSceneName } from '../../types';

export enum EAppEventBusNames {
  WalletClear = 'WalletClear',
  WalletUpdate = 'WalletUpdate',
  AccountUpdate = 'AccountUpdate',
  CloseAllBrowserTab = 'CloseAllBrowserTab',
  DAppConnectUpdate = 'DAppConnectUpdate',
  DAppNetworkUpdate = 'DAppNetworkUpdate',
  GlobalDeriveTypeUpdate = 'GlobalDeriveTypeUpdate',
  AccountSelectorSelectedAccountUpdate = 'AccountSelectorSelectedAccountUpdate',
  // AccountNameChanged = 'AccountNameChanged',
  // CurrencyChanged = 'CurrencyChanged',
  // BackupRequired = 'BackupRequired',
  // NotificationStatusChanged = 'NotificationStatusChanged',
  // StoreInitedFromPersistor = 'StoreInitedFromPersistor',
  // Unlocked = 'Unlocked',
  // HttpServerRequest = 'HttpServerRequest',
}

export interface IAppEventBusPayload {
  [EAppEventBusNames.WalletClear]: undefined;
  [EAppEventBusNames.WalletUpdate]: undefined;
  [EAppEventBusNames.AccountUpdate]: undefined;
  [EAppEventBusNames.CloseAllBrowserTab]: undefined;
  [EAppEventBusNames.DAppConnectUpdate]: undefined;
  [EAppEventBusNames.GlobalDeriveTypeUpdate]: undefined;
  [EAppEventBusNames.AccountSelectorSelectedAccountUpdate]: {
    selectedAccount: IAccountSelectorSelectedAccount;
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  };
  [EAppEventBusNames.DAppNetworkUpdate]: {
    networkId: string;
    sceneName: string;
    sceneUrl: string;
    num: number;
  };
}

export enum EEventBusBroadcastMethodNames {
  uiToBg = 'uiToBg',
  bgToUi = 'bgToUi',
}
type IEventBusBroadcastMethod = (type: string, payload: any) => Promise<void>;

class AppEventBus extends CrossEventEmitter {
  broadcastMethodsResolver: Record<
    EEventBusBroadcastMethodNames,
    ((value: IEventBusBroadcastMethod) => void) | undefined
  > = {
    uiToBg: undefined,
    bgToUi: undefined,
  };

  broadcastMethodsReady: Record<
    EEventBusBroadcastMethodNames,
    Promise<IEventBusBroadcastMethod>
  > = {
    uiToBg: new Promise<IEventBusBroadcastMethod>((resolve) => {
      this.broadcastMethodsResolver.uiToBg = resolve;
    }),
    bgToUi: new Promise<IEventBusBroadcastMethod>((resolve) => {
      this.broadcastMethodsResolver.bgToUi = resolve;
    }),
  };

  broadcastMethods: Record<
    EEventBusBroadcastMethodNames,
    IEventBusBroadcastMethod
  > = {
    uiToBg: async (type: string, payload: any) => {
      const fn = await this.broadcastMethodsReady.uiToBg;
      await fn(type, payload);
    },
    bgToUi: async (type: string, payload: any) => {
      const fn = await this.broadcastMethodsReady.bgToUi;
      await fn(type, payload);
    },
  };

  registerBroadcastMethods(
    name: EEventBusBroadcastMethodNames,
    method: IEventBusBroadcastMethod,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.broadcastMethodsResolver[name]!(method);
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
    void this.emitToRemote(type, payload);
    return true;
  }

  override once<T extends EAppEventBusNames>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.once(type, listener);
  }

  override on<T extends EAppEventBusNames>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.on(type, listener);
  }

  override off<T extends EAppEventBusNames>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.off(type, listener);
  }

  override addListener<T extends EAppEventBusNames>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.addListener(type, listener);
  }

  override removeListener<T extends EAppEventBusNames>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.removeListener(type, listener);
  }

  emitToSelf(type: EAppEventBusNames, ...args: any[]) {
    super.emit(type, ...args);
    return true;
  }

  async emitToRemote(type: string, payload: any) {
    if (platformEnv.isExtensionOffscreen || platformEnv.isWebEmbed) {
      // request background
      throw new Error('offscreen or webembed event bus not support yet.');
    }
    if (platformEnv.isNative) {
      // requestToWebEmbed
    }
    if (platformEnv.isExtensionUi) {
      // request background
      return this.broadcastMethods.uiToBg(type, payload);
    }
    if (platformEnv.isExtensionBackground) {
      // requestToOffscreen
      // requestToAllUi
      return this.broadcastMethods.bgToUi(type, payload);
    }
  }
}
const appEventBus = new AppEventBus();

if (process.env.NODE_ENV !== 'production') {
  global.$$appEventBus = appEventBus;
}

export { appEventBus };
