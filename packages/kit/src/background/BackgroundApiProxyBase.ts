/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */
import platformEnv, { isExtensionUi } from '@onekeyhq/shared/src/platformEnv';

import { INTERNAL_METHOD_PREFIX } from './decorators';
import { ensureSerializable, throwMethodNotFound } from './utils';

import type { IAppSelector, IPersistor, IStore } from '../store';
import type { IBackgroundApi, IBackgroundApiBridge } from './IBackgroundApi';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';

export class BackgroundApiProxyBase implements IBackgroundApiBridge {
  appSelector = {} as IAppSelector;

  persistor = {} as IPersistor;

  store = {} as IStore;

  bridge = {} as JsBridgeBase;

  providers = {};

  // TODO add custom eslint rule to force method name match
  dispatch = (action: any) => {
    this.callBackgroundSync('dispatch', action);
  };

  getState = (): Promise<{ state: any; bootstrapped: boolean }> =>
    this.callBackground('getState');

  sendForProvider(providerName: IInjectedProviderNamesStrings): any {
    return this.backgroundApi?.sendForProvider(providerName);
  }

  connectBridge(bridge: JsBridgeBase) {
    this.backgroundApi?.connectBridge(bridge);
  }

  bridgeReceiveHandler = (
    payload: IJsBridgeMessagePayload,
  ): any | Promise<any> => this.backgroundApi?.bridgeReceiveHandler(payload);

  constructor({
    backgroundApi,
  }: {
    backgroundApi?: any;
  } = {}) {
    if (backgroundApi) {
      this.backgroundApi = backgroundApi as IBackgroundApi;
    }
  }

  // init in NON-Ext UI env
  private readonly backgroundApi?: IBackgroundApi | null = null;

  callBackgroundMethod(
    sync = true,
    method: string,
    ...params: Array<any>
  ): any {
    ensureSerializable(params);
    let [serviceName, methodName] = method.split('.');
    if (!methodName) {
      methodName = serviceName;
      serviceName = '';
    }
    if (serviceName === 'ROOT') {
      serviceName = '';
    }
    const backgroundMethodName = `${INTERNAL_METHOD_PREFIX}${methodName}`;
    if (platformEnv.isExtension && isExtensionUi()) {
      const data = {
        service: serviceName,
        method: backgroundMethodName,
        params,
      };
      if (sync) {
        // call without Promise result
        window.extJsBridgeUiToBg.requestSync({
          data,
        });
      } else {
        return window.extJsBridgeUiToBg.request({
          data,
        });
      }
    } else {
      if (!this.backgroundApi) {
        throw new Error('backgroundApi not found in non-ext env');
      }
      const serviceApi = serviceName
        ? (this.backgroundApi as any)[serviceName]
        : this.backgroundApi;
      if (serviceApi[backgroundMethodName]) {
        return serviceApi[backgroundMethodName].call(serviceApi, ...params);
      }
      throwMethodNotFound(serviceName, backgroundMethodName);
    }
  }

  callBackgroundSync(method: string, ...params: Array<any>): any {
    this.callBackgroundMethod(true, method, ...params);
  }

  callBackground(method: string, ...params: Array<any>): any {
    return this.callBackgroundMethod(false, method, ...params);
  }
}
